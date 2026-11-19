import type { QuadCell } from '../quad-grid';
import { hash } from '../hash-random';
import { cellKey } from './cell-key';
import { CHANNEL } from './form';
import { insetRing } from './outline';
import type { Point2 } from '../parametrik/vocab';

/** P1 mesh direction and pencil ridge direction in world radians on the final footprint. */
export function stockRoofDirection(cell: QuadCell, seed: number) {
	const sides = cell.corners.map(([x, y], i) => [
		cell.corners[(i + 1) % 4][0] - x,
		cell.corners[(i + 1) % 4][1] - y
	]);
	const [dx, dy] = sides.reduce((a, b) => (Math.hypot(...a) >= Math.hypot(...b) ? a : b));
	return Math.atan2(dy, dx) + (hash(seed, cellKey(cell), CHANNEL.ridge) < 0.5 ? 0 : Math.PI / 2);
}

/** Intersect the ridge through the inset footprint centroid with its two gable ends. */
export function pencilGables(cell: QuadCell, seed: number, setback: number) {
	const ring = insetRing(
		cell.corners.map(([x, y]) => [x, y]),
		setback
	);
	const angle = stockRoofDirection(cell, seed),
		dx = Math.cos(angle),
		dy = Math.sin(angle);
	const origin = ring.reduce(([x, y], p) => [x + p[0] / 4, y + p[1] / 4] as Point2, [
		0, 0
	] as Point2);
	const offset = (p: Point2) => dx * (p[1] - origin[1]) - dy * (p[0] - origin[0]);
	return ring.flatMap((a, i) => {
		const b = ring[(i + 1) % 4],
			u = offset(a),
			v = offset(b);
		if (u > 0 === v > 0) return [];
		const t = u / (u - v);
		const peak: Point2 = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
		return [{ a, b, peak }];
	});
}
