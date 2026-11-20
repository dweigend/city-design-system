import type { HouseStructure } from '../house-structure';
import type { HousePart } from './house-object';
import { pipeBetween } from './parts';
import type { Surface } from './surfaces';

export type GroundHeight = (x: number, y: number) => number;

/** Continues each founded frame node vertically to the grade directly beneath its bearing struts. */
export function frameFootings(
	structure: HouseStructure,
	surface: Surface,
	height: GroundHeight
): HousePart[] {
	const radii = new Map<string, number>();
	for (const rod of structure.rods) {
		if (rod.action !== 'strut') continue;
		for (const id of [rod.from, rod.to]) radii.set(id, Math.max(radii.get(id) ?? 0, rod.radius));
	}
	return structure.nodes.flatMap(({ id, founded, position }) => {
		if (!founded) return [];
		const [x, y, seat] = position;
		const z = height(x, y),
			radius = radii.get(id);
		if (!radius || !(z < seat - 1e-8)) return [];
		const foot = pipeBetween(id + '/footing', [x, y, z], position, radius, surface);
		return [{ ...foot, structuralRole: 'bearing' as const }];
	});
}

/** Grounds each clipped masonry plinth on the parcel chart, leaving a narrower pier on flood sites. */
export function seatPlinth(
	part: Extract<HousePart, { kind: 'prism' }>,
	ground: GroundHeight,
	raised: boolean
): HousePart[] {
	const ring = part.polygon;
	const mean = (axis: number) => ring.reduce((sum, p) => sum + p[axis], 0) / ring.length;
	const cx = mean(0),
		cy = mean(1);
	// Ground-room plinths are convex pieces of individual cells, already cut around the entrance.
	const polygon = raised
		? ring.map(([x, y]): [number, number] => [cx + (x - cx) * 0.45, cy + (y - cy) * 0.45])
		: ring;
	const z = Math.min(part.z, ...polygon.map(([x, y]) => ground(x, y)));
	if (!(z < part.z - 1e-8)) return [part];
	if (!raised) return [{ ...part, z, height: part.height + part.z - z }];
	return [part, { ...part, id: part.id + '/pier', polygon, z, height: part.z - z }];
}
