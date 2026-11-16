/**
 * Framing of a view: view direction (world, toward the camera) and half image height.
 * A fixed frame, so that slider and animation do not zoom.
 */
import type { Vec3 } from '../parametrik/types';
import { center, type Bounds } from './geometrie';

export type Blick = 'iso' | 'plan' | 'schnitt-x' | 'schnitt-y';
const r = Math.sqrt(3 / 8);
export const eyes: Record<Blick, Vec3> = {
	iso: [-r, -r, 0.5],
	plan: [0, 0, 1],
	'schnitt-x': [-1, 0, 0],
	'schnitt-y': [0, -1, 0]
};

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
const norm = (a: Vec3): Vec3 => {
	const l = Math.hypot(...a) || 1;
	return [a[0] / l, a[1] / l, a[2] / l];
};

/** Image axes (right, up) of a view direction; plan view: north up. */
export function axes(eye: Vec3): { right: Vec3; up: Vec3 } {
	const e = norm(eye);
	const hint: Vec3 = Math.abs(e[2]) > 0.99 ? [0, 1, 0] : [0, 0, 1];
	const right = norm(cross(hint, e));
	return { right, up: cross(e, right) };
}

/** Center and half image height so that b fits entirely at aspect ratio aspect (width/height). */
export function rahmen(b: Bounds, eye: Vec3, aspect: number, margin = 1.08) {
	const c = center(b);
	const { right, up } = axes(eye);
	let h = 0;
	for (const x of [b.min[0], b.max[0]])
		for (const y of [b.min[1], b.max[1]])
			for (const z of [b.min[2], b.max[2]]) {
				const d: Vec3 = [x - c[0], y - c[1], z - c[2]];
				h = Math.max(h, Math.abs(dot(d, up)), Math.abs(dot(d, right)) / Math.max(aspect, 0.1));
			}
	return { center: c, span: Math.max(h * margin, 1), eye };
}
