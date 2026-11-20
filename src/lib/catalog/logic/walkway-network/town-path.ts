import { required } from '../required';
import { walkingProfile } from './walking-profile';
import { deckCorners } from '../walkway';
import { interpolatePoint, type Vec3 } from '../parametrik/types';
import type { TownSpan } from './town-stations';

type Mouth = {
	span: TownSpan;
	start: boolean;
	right: Vec3;
	left: Vec3;
	center: Vec3;
	angle: number;
};
export type Band = { span: TownSpan; right: Vec3[]; left: Vec3[] };
export type Junction = { id: string; position: Vec3; rim: Vec3[][] };

const key = (p: Vec3) => p.join(',');
function mouths(span: TownSpan, width: number): Mouth[] {
	const { a, b } = span,
		[r, l, v, u] = deckCorners(a, b, width);
	const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
	return [
		{ span, start: true, right: r, left: l, center: a, angle },
		{
			span,
			start: false,
			right: v,
			left: u,
			center: b,
			angle: Math.atan2(a[1] - b[1], a[0] - b[0])
		}
	];
}
function corner(a: Mouth, b: Mouth) {
	const p = a.left,
		q = b.right;
	const divisor = Math.sin(b.angle - a.angle);
	if (Math.abs(divisor) < 1e-8) return interpolatePoint(p, q, 0.5);
	const d = ((q[0] - p[0]) * Math.sin(b.angle) - (q[1] - p[1]) * Math.cos(b.angle)) / divisor;
	return [p[0] + d * Math.cos(a.angle), p[1] + d * Math.sin(a.angle), p[2]] satisfies Vec3;
}
function curve(a: Vec3, b: Vec3, c: Vec3, t: number) {
	return interpolatePoint(interpolatePoint(a, b, t), interpolatePoint(b, c, t), t);
}
function edge(bands: Map<TownSpan, Band>, m: Mouth, left: boolean) {
	const band = required(bands.get(m.span), 'surveyed band');
	return left === m.start ? band.left : band.right;
}
function setEnd(points: Vec3[], start: boolean, pointsOut: Vec3[]) {
	if (start) points.splice(0, 1, ...pointsOut);
	else points.splice(-1, 1, ...pointsOut.toReversed());
}
function fillet(a: Mouth, b: Mouth, width: number) {
	if (a.span.a[2] !== a.span.b[2] || b.span.a[2] !== b.span.b[2]) return;
	const turn = Math.atan2(
		Math.sin(b.angle - a.angle - Math.PI),
		Math.cos(b.angle - a.angle - Math.PI)
	);
	const run = (m: Mouth) => Math.hypot(m.span.a[0] - m.span.b[0], m.span.a[1] - m.span.b[1]);
	const trim = Math.min(2.5, 0.4 * run(a), 0.4 * run(b));
	if (Math.abs(turn) < 0.01) return;
	const radius = trim / Math.tan(Math.abs(turn) / 2),
		sign = Math.sign(turn);
	if (radius <= width / 2 + 0.02) return;
	const [x, y, z] = a.center,
		start = a.angle + Math.PI;
	const cx = x + trim * Math.cos(a.angle) - sign * radius * Math.sin(start);
	const cy = y + trim * Math.sin(a.angle) + sign * radius * Math.cos(start);
	return Array.from({ length: 7 }, (_, i): Vec3 => {
		const angle = start + (turn * i) / 6,
			r = sign * radius + width / 2;
		return [cx + r * Math.sin(angle), cy - r * Math.cos(angle), z];
	});
}
function join(bands: Map<TownSpan, Band>, a: Mouth, b: Mouth, width: number) {
	const p = corner(a, b),
		u = edge(bands, a, true),
		v = edge(bands, b, false);
	const samples = fillet(a, b, width);
	if (!samples) {
		setEnd(u, a.start, [p]);
		setEnd(v, b.start, [p]);
		return;
	}
	setEnd(u, a.start, samples.slice(0, 4).reverse());
	setEnd(v, b.start, samples.slice(3));
}
function forkRim(bands: Map<TownSpan, Band>, a: Mouth, b: Mouth, position: Vec3) {
	const p = corner(a, b);
	const beyond = (m: Mouth, edge: Vec3) =>
		(p[0] - edge[0]) * Math.cos(m.angle) + (p[1] - edge[1]) * Math.sin(m.angle) > 0;
	if (beyond(a, a.left) || beyond(b, b.right)) {
		setEnd(edge(bands, a, true), a.start, [p]);
		setEnd(edge(bands, b, false), b.start, [p]);
		return [p];
	}
	if (Math.hypot(p[0] - position[0], p[1] - position[1]) > 4) return [a.left, b.right];
	return [
		a.left,
		...Array.from({ length: 5 }, (_, j) => curve(a.left, p, b.right, (j + 1) / 6)),
		b.right
	];
}
/** Sweeps paired walking edges through shared stations. Every fork owns the
 * exposed boundary between adjacent mouths, leaving each opening unobstructed. */
export function townPath(
	spans: TownSpan[],
	forks: ReadonlyMap<string, Vec3>,
	width: number = walkingProfile.width
) {
	const bands = new Map<TownSpan, Band>(),
		nodes = new Map<string, Mouth[]>(),
		junctions: Junction[] = [];
	for (const span of spans) {
		const [a, b] = mouths(span, width);
		bands.set(span, { span, right: [a.right, b.left], left: [a.left, b.right] });
		for (const m of [a, b]) {
			const id = key(m.center),
				group = nodes.get(id) ?? [];
			group.push(m);
			nodes.set(id, group);
		}
	}
	for (const group of nodes.values())
		if (group.length === 2) {
			join(bands, group[0], group[1], width);
			join(bands, group[1], group[0], width);
		}
	for (const [id, position] of forks) {
		const arms = [...nodes.values()]
			.flat()
			.filter((m) => (m.start ? m.span.fromFork : m.span.toFork) === id)
			.sort((a, b) => a.angle - b.angle);
		if (arms.length < 2) continue;
		const rim = arms.map((a, i) => forkRim(bands, a, arms[(i + 1) % arms.length], position));
		junctions.push({ id: 'town-walk/joint/' + id, position, rim });
	}
	return { bands: [...bands.values()], junctions };
}
