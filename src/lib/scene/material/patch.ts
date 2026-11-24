import { materialSettings } from '../../../config/material';
import { crossProduct, dotProduct, length, sum, scaled, type Vec2, type Vec3 } from '../../core/geometry';

const { planeToleranceM } = materialSettings;

/** An axis-aligned rectangle in patch meters: left, bottom, right, top. */
export type Rect = readonly [u0: number, v0: number, u1: number, v1: number];

/** A planar surface patch. `across` and `normal` are unit vectors; up is normal × across, so the
 * outward face looks along `normal`. Size, thickness and openings are in meters. The optional
 * outline is a convex counter-clockwise polygon in patch meters, e.g. a gable; the default is
 * the rectangle of `size`. Openings are holes cut through relief and backing. Shadows are convex
 * counter-clockwise polygons in patch meters that other bodies cast onto the face. */
export type Patch = Readonly<{
	origin: Vec3;
	across: Vec3;
	normal: Vec3;
	size: Vec2;
	thickness: number;
	outline?: readonly Vec2[];
	openings?: readonly Rect[];
	shadows?: readonly (readonly Vec2[])[];
	budget?: number;
}>;

/** A patch with its derived up axis and a point mapping from patch meters to world meters. */
export type Frame = Readonly<{
	patch: Patch;
	up: Vec3;
	outline: readonly Vec2[];
	point: (u: number, v: number, w: number) => Vec3;
}>;

/** Validates the patch and returns its frame. Throws RangeError for a non-unit or non-orthogonal
 * axis, a non-positive size or thickness, or an outline that is not convex and counter-clockwise. */
export function readFrame(patch: Patch): Frame {
	const { origin, across, normal, size, thickness } = patch;
	if ([...origin, ...across, ...normal, ...size, thickness].some((x) => !Number.isFinite(x)))
		throw new RangeError('Patch requires finite numbers');
	if (Math.abs(length(across) - 1) > planeToleranceM || Math.abs(length(normal) - 1) > planeToleranceM)
		throw new RangeError('Patch axes must be unit vectors');
	if (Math.abs(dotProduct(across, normal)) > planeToleranceM)
		throw new RangeError('Patch axes must be orthogonal');
	if (size[0] <= 0 || size[1] <= 0 || thickness < 0)
		throw new RangeError('Patch size must be positive and thickness nonnegative');
	const up = crossProduct(normal, across);
	const outline = patch.outline ?? [
		[0, 0],
		[size[0], 0],
		[size[0], size[1]],
		[0, size[1]]
	];
	if (!isConvex(outline)) throw new RangeError('Patch outline must be convex and counter-clockwise');
	const point = (u: number, v: number, w: number): Vec3 =>
		sum(sum(origin, scaled(across, u)), sum(scaled(up, v), scaled(normal, w)));
	return { patch, up, outline, point };
}

function isConvex(polygon: readonly Vec2[]) {
	if (polygon.length < 3) return false;
	return polygon.every((a, i) => {
		const b = polygon[(i + 1) % polygon.length];
		const c = polygon[(i + 2) % polygon.length];
		return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) >= -planeToleranceM;
	});
}

/** Area of the outline minus the openings in square meters. */
export function readPatchArea(frame: Frame) {
	const { outline } = frame;
	let twice = 0;
	for (const [i, [u0, v0]] of outline.entries()) {
		const [u1, v1] = outline[(i + 1) % outline.length];
		twice += u0 * v1 - u1 * v0;
	}
	const holes = (frame.patch.openings ?? []).reduce(
		(total, [u0, v0, u1, v1]) => total + (u1 - u0) * (v1 - v0),
		0
	);
	return Math.max(0, twice / 2 - holes);
}
