import type { Vec3 } from '../../core/geometry';
import type { Mesh } from './mesh';

// Exact arithmetic: the crosshead spans the two offsets at deck elevation.
export function drawBearing(
	mesh: Mesh,
	base: Vec3,
	top: Vec3,
	radiusM: number,
	thicknessM: number
) {
	mesh.pier(base, top[2], radiusM);
	if (Math.hypot(top[0] - base[0], top[1] - base[1]) <= radiusM) return;
	mesh.ribbon([[base[0], base[1], top[2]], top], radiusM * 2, thicknessM);
}
