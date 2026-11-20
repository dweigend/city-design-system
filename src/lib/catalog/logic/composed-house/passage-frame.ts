import { area, clipPolygon, type Bounds, type HalfPlane, type Point2 } from '../ansicht/geometrie';
import { slabOver } from './parts';
import { sectionSurfaces } from './surfaces';
import type { Section } from './types';

export const jamb = 0.12;

/** Clips a convex parcel or room between two parallel reveal planes in world metres. */
export function strip(ring: Point2[], normal: Point2, lo: number, hi: number) {
	return clipPolygon(clipPolygon(ring, { normal, d: hi }), {
		normal: [-normal[0], -normal[1]],
		d: -lo
	});
}
type FramePlate = ReturnType<typeof slabOver>;
function keepDoor(p: FramePlate, door: Bounds): FramePlate[] {
	const z = Math.max(door.min[2], p.z),
		top = Math.min(door.max[2], p.z + p.height);
	if (top <= z) return [p];
	const planes: HalfPlane[] = [
		{ normal: [-1, 0], d: -door.min[0] },
		{ normal: [1, 0], d: door.max[0] },
		{ normal: [0, -1], d: -door.min[1] },
		{ normal: [0, 1], d: door.max[1] }
	];
	if (area(planes.reduce(clipPolygon, p.polygon)) < 1e-9) return [p];
	let ring = p.polygon;
	const kept: FramePlate[] = [];
	for (const { normal, d } of planes) {
		const polygon = clipPolygon(ring, { normal: [-normal[0], -normal[1]], d: -d });
		if (area(polygon) > 1e-9) kept.push({ ...p, polygon, z, height: top - z });
		ring = clipPolygon(ring, { normal, d });
	}
	if (p.z < z) kept.push({ ...p, height: z - p.z });
	if (top < p.z + p.height) kept.push({ ...p, z: top, height: p.z + p.height - top });
	return kept.map((part, i) => ({ ...part, id: p.id + '/return/' + i }));
}
/** Fits two reveals and a soffit to the parcel and retains the existing ladder doorway in the lining. */
export function portalFrame(
	s: Section,
	normal: Point2,
	offset: number,
	width: number,
	z: number,
	head: number
) {
	const ring = s.composition.structure.parcel.polygon;
	const half = width / 2;
	const frame = sectionSurfaces(s).frame;
	const plates = [
		[-half - jamb, -half, z, head],
		[half, half + jamb, z, head],
		[-half - jamb, half + jamb, head, head + jamb]
	].map(([lo, hi, bottom, top], i) =>
		slabOver(
			s.id + '/portal/frame/' + i,
			{
				polygon: strip(ring, normal, offset + lo, offset + hi),
				holes: [],
				z: bottom,
				height: top - bottom
			},
			frame
		)
	);
	return (s.composition.exterior?.openings ?? []).reduce(
		(parts, door) => parts.flatMap((p) => keepDoor(p, door)),
		plates
	);
}
