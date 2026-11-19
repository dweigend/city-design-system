import { BLICK } from '../../data/leitstil';
import { bounds, boxPolygon, rotated, type Point2 } from '../../logic/ansicht/geometrie';
import type { Primitive, Vec3 } from '../../logic/parametrik/types';

const cosAzimuth = Math.cos(BLICK.azimutRad);
const sinAzimuth = Math.sin(BLICK.azimutRad);
const sinElevation = Math.sin(BLICK.hoeheRad);
const cosElevation = Math.cos(BLICK.hoeheRad);

const project = ([x, y, z]: Vec3, plan: boolean): Point2 =>
	plan
		? [x, y]
		: [
				x * cosAzimuth + y * sinAzimuth,
				(-x * sinAzimuth + y * cosAzimuth) * sinElevation + z * cosElevation
			];

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

function prismWidth(polygon: Point2[], height: number, plan: boolean) {
	const bottom = polygon.map(([x, y]) => project([x, y, 0], plan));
	const rise = plan ? 0 : height * cosElevation;
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

function roundWidth(part: Primitive, [depth, rise]: Point2) {
	switch (part.kind) {
		case 'torus':
			return 2 * part.tube;
		case 'pipe':
		case 'capsule':
			return 2 * part.radius;
		case 'ring':
			return part.innerRadius ? part.radius - part.innerRadius : 2 * part.radius;
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
export function contourWidthMeters(part: Primitive, plan: boolean): number {
	const round = roundWidth(part, plan ? [1, 0] : [sinElevation, cosElevation]);
	if (round !== undefined) return round;
	switch (part.kind) {
		case 'prism':
			return prismWidth(rotated(part.polygon, part.rotation ?? 0), part.height, plan);
		case 'box':
		case 'wedge':
			return prismWidth(boxPolygon(part.position, part.size, part.rotation), part.size[2], plan);
		case 'membrane':
			return narrowSpan(part.corners.map((point) => project(point, plan)));
		case 'polyline':
			return Infinity;
		default: {
			const { min, max } = bounds(part);
			const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
			return prismWidth(boxPolygon(min, size), size[2], plan);
		}
	}
}
