import type { Vec3 } from '../../parametrik/types';
import { circle, plate, pipe, shell, crescent } from '../assembly';
import { drum, ring, cap, bulb } from '../parts';
/** Milled rectangular surface with the same small corner return on all four ends. */
export function panel(
	x: number,
	y: number,
	z: number,
	w: number,
	d: number,
	h: number,
	slot = 'slats'
) {
	const r = Math.min(Math.min(w, d) >= 2.5 ? 0.45 : 0.15, w * 0.49, d * 0.49);
	const corners = circle(1, 48).flatMap(([a, b], i): [number, number][] => {
		const quadrant = Math.floor(i / 12);
		const cx = x + (quadrant === 0 || quadrant === 3 ? 1 : -1) * (w / 2 - r);
		const cy = y + (quadrant < 2 ? 1 : -1) * (d / 2 - r);
		const end = ((quadrant + 1) * Math.PI) / 2;
		const p: [number, number] = [cx + a * r, cy + b * r];
		return i % 12 === 11 ? [p, [cx + r * Math.cos(end), cy + r * Math.sin(end)]] : [p];
	});
	return plate(corners, z, h, slot);
}

/** Turned upright member measured from its bottom face. */
export function post(x: number, y: number, z: number, r: number, h: number, slot = 'frame') {
	return drum([x, y, z], slot === 'frame' ? Math.max(r, 0.15) : r, h, slot);
}

/** Bent or straight round stock following its centre line. */
export function rail(points: Vec3[], radius = 0.06, slot = 'frame') {
	return pipe(points, Math.max(radius, 0.06), slot);
}

/** Elliptical roof or cradle; the clear span runs across x. */
export function bow(
	x: number,
	y: number,
	z: number,
	w: number,
	d: number,
	h: number,
	slot = 'shell',
	up = true
) {
	return shell(
		up ? 'vault' : 'halfpipe',
		x,
		y,
		z,
		w,
		d,
		h,
		Math.min(0.15, h * 0.4, w * 0.22),
		slot
	);
}

/** Vertical circular opening, viewed along x. */
export function eye(
	x: number,
	y: number,
	z: number,
	r: number,
	wall: number,
	d: number,
	slot = 'shell'
) {
	return ring([x, y, z], r, r - wall, d, slot);
}

/** Convex lens measured from its equator. */
export function lens(x: number, y: number, z: number, r: number, h: number, slot = 'shell') {
	return cap([x, y, z], r, h, slot);
}

/** Flattened turned finial centred on its fixing. */
export function bead(x: number, y: number, z: number, r: number, squash: number, slot = 'body') {
	return bulb([x, y, z], r, squash, slot);
}

/** Circular band in plan with cut ends. */
export function band(r: number, width: number, z: number, h: number, angle: number, slot = 'foot') {
	return crescent(r, r - width, z, h, angle, slot);
}

/** Closed ring of material with an open centre. */
export function collar(
	x: number,
	y: number,
	z: number,
	r: number,
	wall: number,
	h: number,
	slot = 'body'
) {
	const edge = (radius: number) => circle(radius).map(([a, b]): [number, number] => [a + x, b + y]);
	return plate(edge(r), z, h, slot, edge(r - wall).reverse());
}
