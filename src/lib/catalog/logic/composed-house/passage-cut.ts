import { area, bounds, type Point2 } from '../ansicht/geometrie';
import type { Primitive, Vec3 } from '../parametrik/types';
import { openSurface } from './shell-openings';
import { planPoints } from './part-plan';
import { jamb, portalFrame, strip } from './passage-frame';
import type { Section } from './types';

type Plate = Extract<Primitive, { kind: 'prism' }>;
type Lane = {
	normal: Point2;
	offset: number;
	clearWidth: number;
	headroom: number;
	entry: { position: Vec3 };
};
function transverse([x, y]: readonly number[], n: Point2) {
	return x * n[0] + y * n[1];
}
function crosses(p: Primitive, l: Lane) {
	const z = l.entry.position[2],
		b = bounds(p);
	if (b.max[2] <= z + 1e-8 || b.min[2] >= z + l.headroom - 1e-8) return false;
	const ds = planPoints(p).map((q) => transverse(q, l.normal) - l.offset);
	return Math.min(...ds) < l.clearWidth / 2 && Math.max(...ds) > -l.clearWidth / 2;
}
function clippable(p: Primitive, l: Lane) {
	if (!crosses(p, l)) return true;
	if (p.id.includes('/stair/')) return false;
	if (p.kind === 'mesh') return true;
	return (
		p.kind === 'prism' &&
		!p.rotation &&
		(p.holes ?? []).every((h) => {
			const ds = h.map((q) => transverse(q, l.normal) - l.offset);
			return Math.min(...ds) > l.clearWidth / 2 || Math.max(...ds) < -l.clearWidth / 2;
		})
	);
}
function roughOpening(l: Lane) {
	return { ...l, clearWidth: l.clearWidth + 2 * jamb, headroom: l.headroom + jamb };
}
/** Checks that trimming only envelope panels and masonry leaves a continuous walking volume. */
export function canOpenPassage(parts: Primitive[], lane: Lane) {
	const opening = roughOpening(lane);
	return parts.every((p) => clippable(p, opening));
}
function cutPlate(p: Plate, l: Lane): Primitive[] {
	const floor = l.entry.position[2],
		ceiling = floor + l.headroom;
	const z = Math.max(p.z, floor),
		top = Math.min(p.z + p.height, ceiling);
	const half = l.clearWidth / 2;
	const solids: Primitive[] = [];
	for (const [i, [lo, hi]] of [
		[-Infinity, l.offset - half],
		[l.offset + half, Infinity]
	].entries()) {
		const polygon = strip(p.polygon, l.normal, lo, hi);
		if (area(polygon) > 1e-8)
			solids.push({
				...p,
				id: p.id + '/reveal/' + i,
				polygon,
				holes: p.holes?.filter((h) => {
					const d = transverse(h[0], l.normal);
					return d >= lo && d <= hi;
				}),
				z,
				height: top - z
			});
	}
	if (z > p.z) solids.push({ ...p, height: z - p.z });
	if (top < p.z + p.height)
		solids.push({ ...p, id: p.id + '/head', z: top, height: p.z + p.height - top });
	return solids;
}
function cutMesh(p: Extract<Primitive, { kind: 'mesh' }>, l: Lane) {
	const [x, y] = l.normal;
	const local = p.points.map(([u, v, z]): Vec3 => [u * x + v * y, -u * y + v * x, z]);
	const floor = l.entry.position[2],
		half = l.clearWidth / 2;
	const mesh = openSurface(
		{ points: local, triangles: p.triangles },
		{
			min: [l.offset - half, -Infinity, floor],
			max: [l.offset + half, Infinity, floor + l.headroom]
		}
	);
	return {
		...p,
		points: mesh.points.map(([u, v, z]): Vec3 => [u * x - v * y, u * y + v * x, z]),
		triangles: mesh.triangles,
		lines: []
	};
}
/** Cuts the two facades and ground rooms to the surveyed sills and lines the opening in the house frame slot. */
export function openHousePassage(
	s: Section,
	passage: {
		entry: { position: Vec3 };
		exit: { outward: readonly [number, number] };
		clearWidth: number;
		headroom: number;
	},
	parts: Primitive[]
): Primitive[] {
	const [u, v] = passage.exit.outward;
	const normal: Point2 = [-v, u];
	const offset = transverse(passage.entry.position, normal);
	const l = roughOpening({ ...passage, normal, offset });
	return [
		...parts.flatMap((p): Primitive[] => {
			if (!crosses(p, l)) return [p];
			if (p.kind === 'prism') return cutPlate(p, l);
			if (p.kind === 'mesh') {
				const cut = cutMesh(p, l);
				return cut.triangles.length ? [cut] : [];
			}
			throw Error('Obstructed house passage ' + s.id);
		}),
		...portalFrame(
			s,
			normal,
			offset,
			passage.clearWidth,
			passage.entry.position[2],
			passage.entry.position[2] + passage.headroom
		)
	];
}
