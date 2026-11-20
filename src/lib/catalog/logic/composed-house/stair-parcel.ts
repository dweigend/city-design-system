import type { StockPart } from './house-object';
import { area, clipPolygon, type Point2 } from '../ansicht/geometrie';
import type { Section } from './types';

/** Tests a bearing footprint against the full union of painted cells without an overhang. */
export function parcelSupports(s: Section, polygon: Point2[]) {
	let covered = 0;
	for (const cell of s.cells) {
		let clipped = polygon;
		for (const [i, [x, y]] of cell.corners.entries()) {
			const end = cell.corners[(i + 1) % cell.corners.length];
			const normal: Point2 = [end[1] - y, x - end[0]];
			clipped = clipPolygon(clipped, { normal, d: normal[0] * x + normal[1] * y });
			if (!clipped.length) break;
		}
		covered += area(clipped);
	}
	return covered >= area(polygon) - 1e-8;
}

/** Covers the full rail tube with overlapping discs inside the 0.6 m cantilever allowance. */
export function parcelFitsRail(s: Section, p: Extract<StockPart, { kind: 'pipe' }>) {
	const [a, b] = p.points;
	const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2));
	for (let i = 0; i <= n; i++) {
		const x = a[0] + ((b[0] - a[0]) * i) / n,
			y = a[1] + ((b[1] - a[1]) * i) / n;
		if (
			!s.cells.some(
				(cell) =>
					cell.corners.every(([u, v], j, ring) => {
						const q = ring[(j + 1) % ring.length],
							dx = q[0] - u,
							dy = q[1] - v;
						return dx * (y - v) - dy * (x - u) >= 0;
					}) ||
					cell.corners.some(([u, v], j, ring) => {
						const end = ring[(j + 1) % ring.length],
							dx = end[0] - u,
							dy = end[1] - v;
						const t = Math.max(0, Math.min(1, ((x - u) * dx + (y - v) * dy) / (dx * dx + dy * dy)));
						return Math.hypot(x - u - t * dx, y - v - t * dy) <= 0.6 - p.radius - 0.1;
					})
			)
		)
			return false;
	}
	return true;
}
