import { interpolation, type Vec3 } from '../../core/geometry';
import type { Footprint } from '../../core/object';

// Exact arithmetic: clip two axes against the centered footprint rectangle.
export function clip(a: Vec3, b: Vec3, { width, depth }: Footprint): [Vec3, Vec3] | undefined {
	const edges = [width / 2, depth / 2];
	let entry = 0;
	let exit = 1;
	for (let axis = 0; axis < edges.length; axis++) {
		const edge = edges[axis];
		const run = b[axis] - a[axis];
		if (run === 0) {
			if (Math.abs(a[axis]) > edge) return;
			continue;
		}
		const start = (-edge - a[axis]) / run;
		const end = (edge - a[axis]) / run;
		entry = Math.max(entry, Math.min(start, end));
		exit = Math.min(exit, Math.max(start, end));
		if (entry >= exit) return;
	}
	return [interpolation(a, b, entry), interpolation(a, b, exit)];
}

// Exact arithmetic: a footprint is centered, so its limits are half of the full dimensions.
export function onFootprint([x, y]: Vec3, { width, depth }: Footprint) {
	return Math.abs(x) <= width / 2 && Math.abs(y) <= depth / 2;
}
