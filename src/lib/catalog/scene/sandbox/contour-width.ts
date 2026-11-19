import { BLICK } from '../../data/leitstil';
import { boxPolygon, rotated, type Point2 } from '../../logic/ansicht/geometrie';
import type { Primitive, Vec3 } from '../../logic/parametrik/types';

import { convexHull, type Point } from '../../logic/parzelle';
import { build } from '../primitive-geometry';

const cosAzimuth = Math.cos(BLICK.azimutRad);
const sinAzimuth = Math.sin(BLICK.azimutRad);
function projection(elevation: number) {
	if (elevation === Math.PI / 2)
		return {
			depth: 1,
			rise: 0,
			point: ([x, y]: Vec3): Point2 => [x, y]
		};
	const depth = Math.sin(elevation);
	const rise = Math.cos(elevation);
	return {
		depth,
		rise,
		point: ([x, y, z]: Vec3): Point2 => [
			x * cosAzimuth + y * sinAzimuth,
			(-x * sinAzimuth + y * cosAzimuth) * depth + z * rise
		]
	};
}

// A minimum width is normal to a hull edge. Scan all vertices for its opposite
// support: equal projected supports can precede a larger one after rounding.
function narrowSpan(hull: readonly Point[]) {
	if (hull.length < 3) return 0;
	let minimum = Infinity;
	for (const [i, [x, y]] of hull.entries()) {
		const [u, v] = hull[(i + 1) % hull.length];
		const dx = u - x,
			dy = v - y;
		let low = 0,
			high = 0;
		for (const [px, py] of hull) {
			const support = dx * (py - y) - dy * (px - x);
			low = Math.min(low, support);
			high = Math.max(high, support);
		}
		minimum = Math.min(minimum, (high - low) / Math.hypot(dx, dy));
	}
	return minimum;
}

function prismWidth(polygon: Point2[], height: number, camera: ReturnType<typeof projection>) {
	const points = polygon.flatMap(([x, y]) => [
		camera.point([x, y, 0]),
		camera.point([x, y, height])
	]);
	return narrowSpan(convexHull(points));
}

function ringWidth(
	part: Extract<Primitive, { kind: 'ring' }>,
	camera: ReturnType<typeof projection>
) {
	if (part.innerRadius > 0) return part.radius - part.innerRadius;
	// Geometry extrudes along local x, tilts up, then turns in plan.
	const tilt = part.tilt ?? 0;
	const turn = part.rotation ?? 0;
	const horizontal = Math.cos(tilt);
	const axis: Vec3 = [horizontal * Math.cos(turn), horizontal * Math.sin(turn), Math.sin(tilt)];
	const projectedAxis = Math.min(1, Math.hypot(...camera.point(axis)));
	const projectedFace = Math.sqrt(1 - projectedAxis * projectedAxis);
	return Math.min(2 * part.radius, 2 * part.radius * projectedFace + part.depth * projectedAxis);
}

function sectionWidth(part: Primitive, camera: ReturnType<typeof projection>) {
	switch (part.kind) {
		case 'torus':
			return 2 * part.tube;
		case 'pipe':
		case 'capsule':
			return 2 * part.radius;
		case 'ring':
			return ringWidth(part, camera);
	}
}

function roundWidth(part: Primitive, { depth, rise }: ReturnType<typeof projection>) {
	switch (part.kind) {
		case 'cylinder':
			return Math.min(2 * part.radius, 2 * part.radius * depth + part.height * rise);
		case 'sphere': {
			const vertical = Math.hypot(depth, (part.squash ?? 1) * rise);
			return 2 * part.radius * Math.min(1, vertical);
		}
	}
}

// Measure the same coarse solid used by the sandbox batch. Translation cannot change width.
function builtWidth(
	part: Exclude<Primitive, { kind: 'polyline' }>,
	camera: ReturnType<typeof projection>
) {
	const { geometry, rotation } = build(part, true);
	try {
		const pos = geometry.getAttribute('position'),
			index = geometry.index;
		const indices = index ? new Set(index.array) : Array.from({ length: pos.count }, (_, i) => i);
		const c = Math.cos(rotation),
			s = Math.sin(rotation);
		const points = Array.from(indices, (i) => {
			const x = pos.getX(i),
				y = -pos.getZ(i);
			return camera.point([c * x - s * y, s * x + c * y, pos.getY(i)]);
		});
		return narrowSpan(convexHull(points));
	} finally {
		geometry.dispose();
	}
}

/** Feature width in projected meters before CSS pixel scaling.
 * Hollow rings and pipes use the width of their material section. */
export function contourWidthMeters(part: Primitive, elevation: number): number {
	const camera = projection(elevation);
	const round = sectionWidth(part, camera) ?? roundWidth(part, camera);
	if (round !== undefined) return round;
	switch (part.kind) {
		case 'prism':
			return prismWidth(rotated(part.polygon, part.rotation ?? 0), part.height, camera);
		case 'box':
			return prismWidth(boxPolygon([0, 0, 0], part.size, part.rotation), part.size[2], camera);
		case 'membrane':
			if (!part.sag) return narrowSpan(convexHull(part.corners.map(camera.point)));
			return builtWidth(part, camera);
		case 'mesh': {
			const points = Array.from(new Set(part.triangles), (i) => camera.point(part.points[i]));
			return narrowSpan(convexHull(points));
		}
		case 'polyline':
			return Infinity;
		default:
			return builtWidth(part, camera);
	}
}
