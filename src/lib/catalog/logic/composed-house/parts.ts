import { houseObject } from './house-object';
import type { Surface } from './surfaces';
import type { Vec3 } from '../parametrik/types';

function member(objectId: string, variant: string, id: string, body: Surface) {
	// These fixed primitive variants have no random dimensions.
	const { parts } = houseObject(objectId, variant, 0, { instanceId: id, slots: { body } });
	if (parts.length !== 1) throw new Error('Expected one structural member in ' + objectId);
	return { ...parts[0], id };
}

/** Fits the registered column to a circular bearing and its surveyed rise. */
export function column(
	id: string,
	position: Vec3,
	radius: number,
	height: number,
	surface: Surface
) {
	const p = member('primitive-cylinder', 'short', id, surface);
	if (p.kind !== 'cylinder') throw new Error('Expected column');
	return { ...p, position, radius, height };
}

/** Fits rectangular stock to its lower centre and world-metre dimensions. */
export function beam(id: string, [x, y, z]: Vec3, size: Vec3, surface: Surface) {
	const p = member('primitive-box', 'short', id, surface);
	if (p.kind !== 'box') throw new Error('Expected beam');
	return { ...p, size, position: [x - size[0] / 2, y - size[1] / 2, z] as Vec3 };
}

/** Maps the registered straight pipe's centreline stations onto the surveyed span. */
export function pipeBetween(id: string, a: Vec3, b: Vec3, radius: number, surface: Surface) {
	const p = member('primitive-pipe', 'short', id, surface);
	if (p.kind !== 'pipe') throw new Error('Expected pipe');
	const start = p.points[0][0],
		run = p.points[p.points.length - 1][0] - start;
	const points = p.points.map(([x]): Vec3 => {
		const t = (x - start) / run;
		return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
	});
	return { ...p, radius, points };
}

function plate(id: string, variant: string, surface: Surface) {
	const p = member('primitive-slab', variant, id, surface);
	if (p.kind !== 'prism') throw new Error('Expected slab');
	return p;
}

/** Fits the registered slab to its seat, retaining circular corner fillets in metre space. */
export function slab(
	id: string,
	[x, y, z]: Vec3,
	w: number,
	d: number,
	height: number,
	r: number,
	surface: Surface
) {
	const radius = Math.min(w / 2, d / 2, r);
	const round = radius === w / 2 && radius === d / 2;
	const p = plate(id, round ? 'round' : 'rounded', surface);
	const corner = Math.abs(p.polygon[0][1]);
	const fit = (v: number, span: number) =>
		round
			? v * span
			: Math.sign(v) * (span / 2 - radius) +
				((v - Math.sign(v) * corner) * radius) / (0.5 - corner);
	return {
		...p,
		polygon: p.polygon.map(([u, v]): [number, number] => [x + fit(u, w), y + fit(v, d)]),
		z,
		height
	};
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
