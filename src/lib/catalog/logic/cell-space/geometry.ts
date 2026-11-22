import type { CellPoint } from './types';

// Relative to the local span, matching the carrier's length and volume tolerances.
const LENGTH_TOLERANCE = 1e-9;
const VOLUME_TOLERANCE = 1e-8;
const axes = [0, 1, 2] as const;

function subtract(a: CellPoint, b: CellPoint): CellPoint {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: CellPoint, b: CellPoint): CellPoint {
	return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: CellPoint, b: CellPoint): number {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function span(points: readonly CellPoint[]) {
	return Math.max(
		1,
		...axes.map(
			(axis) => Math.max(...points.map((p) => p[axis])) - Math.min(...points.map((p) => p[axis]))
		)
	);
}

export function validateRing(points: readonly CellPoint[], id: string) {
	const size = span(points);
	const epsilon = LENGTH_TOLERANCE * size;
	const origin = points[0];
	const offsets = points.map((point) => subtract(point, origin));
	const axis = offsets[1];
	const normals = offsets.slice(2).map((offset) => cross(axis, offset));
	const normal = normals.find((n) => Math.hypot(...n) > epsilon * size);
	if (
		!normal ||
		points.some((p, i) => Math.hypot(...subtract(p, points[(i + 1) % points.length])) <= epsilon)
	)
		throw new RangeError('Degenerate face ' + id);
	if (offsets.some((p) => Math.abs(dot(normal, p)) > epsilon * Math.hypot(...normal)))
		throw new RangeError('Nonplanar face ' + id);
}

export function volumeTolerance(points: readonly CellPoint[]) {
	return VOLUME_TOLERANCE * span(points) ** 3;
}

export function signedFaceVolume(points: readonly CellPoint[], origin: CellPoint) {
	const offsets = points.map((point) => subtract(point, origin));
	let volume = 0;
	for (let i = 1; i + 1 < offsets.length; i++)
		volume += dot(offsets[0], cross(offsets[i], offsets[i + 1]));
	return volume / 6;
}
