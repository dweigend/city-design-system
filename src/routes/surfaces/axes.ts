import type { Vec3 } from '../../lib/core/geometry';

// Exact arithmetic: unit axes of the world frame, Z up.
export const axes = Object.freeze({
	east: [1, 0, 0] as Vec3,
	west: [-1, 0, 0] as Vec3,
	north: [0, 1, 0] as Vec3,
	south: [0, -1, 0] as Vec3,
	up: [0, 0, 1] as Vec3
});
