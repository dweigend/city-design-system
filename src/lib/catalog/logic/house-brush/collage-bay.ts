import type { Vec3 } from '../parametrik/types';
import type { QuadCell } from '../quad-grid';

/** Bilinear coordinates in one oriented bay; z is an absolute elevation in meters. */
export function bayOf(cell: QuadCell, side: number) {
	const [a, b, c, d] = Array.from({ length: 4 }, (_, i) => cell.corners[(side + i) % 4]);
	return (u: number, v: number, z: number): Vec3 => {
		// Continue cantilevers by translation so converging edges cannot cross outside a tapered bay.
		const x = Math.max(0, Math.min(1, u)),
			y = Math.max(0, Math.min(1, v));
		const du = (u - x) / 2,
			dv = (v - y) / 2;
		const weights = [
			(1 - x) * (1 - y) - du - dv,
			x * (1 - y) + du - dv,
			x * y + du + dv,
			(1 - x) * y - du + dv
		];
		const axis = (i: number) =>
			weights[0] * a[i] + weights[1] * b[i] + weights[2] * c[i] + weights[3] * d[i];
		return [axis(0), axis(1), z];
	};
}

export type Bay = ReturnType<typeof bayOf>;

/** Corners of a rectangular cut on the bilinear drawing surface. */
export function panel(
	at: Bay,
	u: number,
	v: number,
	w: number,
	d: number,
	z: number
): [Vec3, Vec3, Vec3, Vec3] {
	return [at(u, v, z), at(u + w, v, z), at(u + w, v + d, z), at(u, v + d, z)];
}
