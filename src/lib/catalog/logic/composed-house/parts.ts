import { interpolatePoint } from '../parametrik/types';
import { houseObject } from './house-object';
import type { Surface } from './surfaces';
import type { Vec3 } from '../parametrik/types';

function member(objectId: string, variant: string, id: string, body: Surface) {
	// These fixed primitive variants have no random dimensions.
	const { parts } = houseObject(objectId, variant, 0, { instanceId: id, slots: { body } });
	if (parts.length !== 1) throw new Error('Expected one structural member in ' + objectId);
	return { ...parts[0], id };
}

/** Maps the registered straight pipe's centreline stations onto the surveyed span. */
export function pipeBetween(id: string, a: Vec3, b: Vec3, radius: number, surface: Surface) {
	const p = member('primitive-pipe', 'short', id, surface);
	if (p.kind !== 'pipe') throw new Error('Expected pipe');
	const start = p.points[0][0],
		run = p.points[p.points.length - 1][0] - start;
	const points = p.points.map(([x]) => interpolatePoint(a, b, (x - start) / run));
	return { ...p, radius, points };
}

function plate(id: string, variant: string, surface: Surface) {
	const p = member('primitive-slab', variant, id, surface);
	if (p.kind !== 'prism') throw new Error('Expected slab');
	return p;
}

/** Cuts the square registry plate to a surveyed outline between z and z + height, metres. */
export function slabOver(
	id: string,
	shape: { polygon: [number, number][]; holes: [number, number][][]; z: number; height: number },
	surface: Surface
) {
	const { polygon, holes, z, height } = shape;
	return { ...plate(id, 'square', surface), polygon, holes, z, height };
}

/** Maps the four corners of a square registry plate to a surveyed walkway tread. */
export function tread(
	id: string,
	ring: [number, number][],
	z: number,
	height: number,
	surface: Surface
) {
	const p = plate(id, 'square', surface);
	return {
		...p,
		z,
		height,
		polygon: p.polygon.map(([x, y]) => ring[y < 0 ? (x < 0 ? 0 : 1) : x < 0 ? 3 : 2])
	};
}
