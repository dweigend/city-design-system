import type { Point } from './types';

/** Rectangle corners in counterclockwise order at the walking datum. */
export function corners([x, y, z]: Point, w: number, d: number): Point[] {
	return [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1]
	].map(([u, v]) => [x + (u * w) / 2, y + (v * d) / 2, z]);
}
