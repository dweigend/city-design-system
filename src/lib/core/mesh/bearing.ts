import type { Vec3 } from '../geometry';
type BearingMesh = {
	pier(base: Vec3, topM: number, radiusM: number): void;
	ribbon(points: readonly Vec3[], widthM: number, thicknessM: number): void;
};

// Exact arithmetic: the crosshead spans the two offsets at deck elevation.
export function drawBearing(
	mesh: BearingMesh,
	base: Vec3,
	top: Vec3,
	radiusM: number,
	thicknessM: number
) {
	mesh.pier(base, top[2], radiusM);
	if (Math.hypot(top[0] - base[0], top[1] - base[1]) <= radiusM) return;
	mesh.ribbon([[base[0], base[1], top[2]], top], radiusM * 2, thicknessM);
}
