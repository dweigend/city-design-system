import type { Vec3 } from '../../../parametrik/types';
import type { ObjectGeometry } from '../../object-geometry';
import type { Gesture } from './action-figure';
import { drum, ring } from '../../parts';
export type Action = { pose: Gesture; props: ObjectGeometry[] };
/** Places a pair of ankles in metre-space, in left/right order. */
export const feet = (front: number, back: number, z = 0.1): [Vec3, Vec3] => [
	[front, -0.13, z],
	[back, 0.13, z]
];
/** Places two hands symmetrically about the figure's forward axis. */
export const hands = (x: number, y: number, z: number): [Vec3, Vec3] => [
	[x, -y, z],
	[x, y, z]
];
export const upright = 1.75 - 0.18 * 1.98 - Math.sqrt(0.52 ** 2 - 0.1 ** 2);
/** Fixed seated dimensions place the hip over the 46 cm stool. */
export function sitting(v: number): Gesture {
	return {
		hip: 0.56,
		lean: 0.05 + v * 0.045,
		feet: feet(0.34, 0.39),
		hands: hands(0.4, 0.18, 0.91)
	};
}
/** Two-piece stool with a stable floor contact and a timber seat. */
export function seat() {
	return [drum([0, 0, 0], 0.18, 0.34, 'gear'), drum([0, 0, 0.34], 0.31, 0.12, 'skin')];
}
/** Creates one solid deck wheel facing along x, resting on the ground plane. */
export function wheels(x: number, y: number, r: number) {
	return { ...ring([x, y, r], r, 0, r * 0.65, 'gear'), rotation: Math.PI / 2 };
}
