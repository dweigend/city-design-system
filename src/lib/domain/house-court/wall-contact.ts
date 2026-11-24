import { defaults } from '../../../config/house-court';
import type { Vec2 } from '../../core/geometry';
import type { side } from './boxes';

const { faceToleranceM } = defaults;

/** A wall on an adjoining parcel, directed counterclockwise, with its occupied elevation range
 * in world meters. The wall hides only the coincident portion of an oppositely directed face. */
export type AdjoiningWall = Readonly<{ a: Vec2; b: Vec2; bottom: number; top: number }>;

export type WallRect = readonly [left: number, bottom: number, right: number, top: number];

type Wall = ReturnType<typeof side>;

function overlap(wall: Wall, other: AdjoiningWall): WallRect | undefined {
	const [nx, ny] = wall.normal;
	const offset = ([x, y]: Vec2) => (x - wall.a[0]) * nx + (y - wall.a[1]) * ny;
	if (Math.abs(offset(other.a)) > faceToleranceM || Math.abs(offset(other.b)) > faceToleranceM)
		return undefined;
	const along = ([x, y]: Vec2) => (x - wall.a[0]) * -ny + (y - wall.a[1]) * nx;
	const [right, left] = [along(other.a), along(other.b)];
	return right > left ? [left, other.bottom, right, other.top] : undefined;
}

function subtract(rect: WallRect, covered: WallRect): WallRect[] {
	const [a, b, c, d] = rect;
	const x0 = Math.max(a, covered[0]);
	const z0 = Math.max(b, covered[1]);
	const x1 = Math.min(c, covered[2]);
	const z1 = Math.min(d, covered[3]);
	if (x1 - x0 <= faceToleranceM || z1 - z0 <= faceToleranceM) return [rect];
	const pieces: WallRect[] = [
		[a, b, x0, d],
		[x1, b, c, d],
		[x0, b, x1, z0],
		[x0, z1, x1, d]
	];
	return pieces.filter(
		([l, bottom, r, top]) => r - l > faceToleranceM && top - bottom > faceToleranceM
	);
}

/** The exposed rectangles of a wall run, measured from its start and at world elevations. */
// Exact arithmetic: the wall run starts at its local origin.
export function exposedWall(
	adjoiningWalls: readonly AdjoiningWall[],
	wall: Wall,
	bottom: number,
	top: number
): WallRect[] {
	let parts: WallRect[] = /* Exact arithmetic: wall run starts at its local origin. */ [
		[0, bottom, wall.length, top]
	];
	for (const other of adjoiningWalls) {
		if (other.top <= bottom || other.bottom >= top) continue;
		const covered = overlap(wall, other);
		if (covered) parts = parts.flatMap((part) => subtract(part, covered));
		if (!parts.length) break;
	}
	return parts;
}

/** True when one exposed piece contains the whole opening. */
export function fitsOpening(parts: readonly WallRect[], [l, b, r, t]: WallRect): boolean {
	return parts.some(
		([a, z0, c, z1]) =>
			l >= a - faceToleranceM &&
			r <= c + faceToleranceM &&
			b >= z0 - faceToleranceM &&
			t <= z1 + faceToleranceM
	);
}
