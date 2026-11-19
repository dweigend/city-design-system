import { BLICK } from '../../data/leitstil';
import { bounds, boxPolygon, rotated, type Point2 } from '../../logic/ansicht/geometrie';
import type { Primitive, Vec3 } from '../../logic/parametrik/types';

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

function span(points: Point2[], dx: number, dy: number) {
	const dots = points.map(([x, y]) => x * dx + y * dy);
	return Math.max(...dots) - Math.min(...dots);
}

function narrowSpan(points: Point2[]) {
	const sides = points.map(([x, y], i): Point2 => {
		const [a, b] = points[(i + 1) % points.length];
		return [a - x, b - y];
	});
	return sides.reduce((width, [x, y]) => {
		const length = Math.hypot(x, y);
		return length ? Math.min(width, span(points, -y / length, x / length)) : width;
	}, Infinity);
}

function prismWidth(polygon: Point2[], height: number, camera: ReturnType<typeof projection>) {
	const bottom = polygon.map(([x, y]) => camera.point([x, y, 0]));
	const rise = height * camera.rise;
	// Each candidate normal comes from the footprint sides or the extrusion direction.
	const widths = bottom.map(([x, y], i) => {
		const [a, b] = bottom[(i + 1) % bottom.length];
		const length = Math.hypot(a - x, b - y);
		if (!length) return Infinity;
		const nx = (y - b) / length,
			ny = (a - x) / length;
		return span(bottom, nx, ny) + Math.abs(ny * rise);
	});
	return Math.min(span(bottom, 1, 0), ...widths);
}

function sectionWidth(part: Primitive) {
	switch (part.kind) {
		case 'torus':
			return 2 * part.tube;
		case 'pipe':
		case 'capsule':
			return 2 * part.radius;
		case 'ring':
			return part.innerRadius ? part.radius - part.innerRadius : 2 * part.radius;
	}
}

function roundWidth(part: Primitive, { depth, rise }: ReturnType<typeof projection>) {
	switch (part.kind) {
		case 'cylinder':
		case 'cone':
			return Math.min(2 * part.radius, 2 * part.radius * depth + part.height * rise);
		case 'sphere': {
			const vertical = Math.hypot(depth, (part.squash ?? 1) * rise);
			return 2 * part.radius * Math.min(1, vertical);
		}
	}
}

/** Feature width in projected meters before CSS pixel scaling.
 * Rings and pipes use the width of their material section. */
export function contourWidthMeters(part: Primitive, elevation: number): number {
	const camera = projection(elevation);
	const round = sectionWidth(part) ?? roundWidth(part, camera);
	if (round !== undefined) return round;
	switch (part.kind) {
		case 'prism':
			return prismWidth(rotated(part.polygon, part.rotation ?? 0), part.height, camera);
		case 'box':
		case 'wedge':
			return prismWidth(boxPolygon(part.position, part.size, part.rotation), part.size[2], camera);
		case 'membrane':
			return narrowSpan(part.corners.map(camera.point));
		case 'polyline':
			return Infinity;
		default: {
			const { min, max } = bounds(part);
			const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
			return prismWidth(boxPolygon(min, size), size[2], camera);
		}
	}
}
