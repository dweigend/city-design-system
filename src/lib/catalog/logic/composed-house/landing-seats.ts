import { bounds } from '../ansicht/geometrie';
import type { HousePart } from './house-object';
import { planPoints } from './part-plan';
import { tread } from './parts';
import type { Surface } from './surfaces';
type XY = [number, number];

function nearest(p: XY, a: XY, b: XY): XY {
	const dx = b[0] - a[0],
		dy = b[1] - a[1];
	const length = Math.hypot(dx, dy);
	if (length === 0) return a;
	const u = dx / length,
		v = dy / length;
	const reach = Math.min(length, Math.max(0, (p[0] - a[0]) * u + (p[1] - a[1]) * v));
	return [a[0] + reach * u, a[1] + reach * v];
}
function nearestEdge(p: XY, polygon: XY[]) {
	const candidates = polygon.map((a, i) => nearest(p, a, polygon[(i + 1) % polygon.length]));
	return candidates.reduce((a, b) => (distance(p, a) < distance(p, b) ? a : b));
}
const distance = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function seat(a: XY, b: XY, z: number, id: string, surface: Surface) {
	const length = distance(a, b),
		u = ((a[1] - b[1]) * 0.15) / length,
		v = ((b[0] - a[0]) * 0.15) / length;
	const plate = tread(
		id,
		[
			[a[0] + u, a[1] + v],
			[b[0] + u, b[1] + v],
			[b[0] - u, b[1] - v],
			[a[0] - u, a[1] - v]
		],
		z,
		0.12,
		surface
	);
	const [s1, e1, e2, s2] = plate.polygon;
	return { ...plate, polygon: [s1, e1, b, e2, s2, a] };
}
function facesOf(p: HousePart) {
	if (p.kind === 'prism') return [p.polygon, ...(p.holes ?? [])];
	if (p.kind === 'cylinder') return [planPoints(p)];
	if (p.kind !== 'box') return [];
	const [a, b, c, d] = planPoints(p);
	return [[a, b, d, c]];
}
/** Seats each switchback half-landing on a short deck cantilever from the nearest surveyed face. */
export function landingSeats(walk: HousePart[], house: HousePart[], surface: Surface) {
	const faces = house
		.filter(
			(p) =>
				p.id.includes('/post/') ||
				p.id.includes('/shaft/') ||
				p.id.includes('/body/') ||
				p.kind === 'prism'
		)
		.flatMap((p) => facesOf(p).map((outline) => ({ box: bounds(p), outline })));
	return walk.flatMap((p) => {
		if (p.kind !== 'prism' || !/\/\d+\/landing$/.test(p.id)) return [];
		const candidates = faces.filter(
			(f) => f.box.max[2] >= p.z - 0.02 && f.box.min[2] <= p.z + p.height + 0.02 && f.outline.length
		);
		if (!candidates.length) return [];
		const centre: XY = [
			(p.polygon[0][0] + p.polygon[2][0]) / 2,
			(p.polygon[0][1] + p.polygon[2][1]) / 2
		];
		const spans = candidates.map((f) => {
			const start = nearestEdge(centre, f.outline),
				end = nearestEdge(start, p.polygon);
			return { start, end, length: distance(start, end) };
		});
		const { start, end, length } = spans.reduce((a, b) => (a.length < b.length ? a : b));
		return length < 0.02
			? []
			: [seat(start, end, p.z, p.id.replace('/stair/', '/landing-seat/'), surface)];
	});
}
