import { houseStair } from '../../data/house-stair';
import type { QuadCell } from '../quad-grid';
import { footprintBay } from './footprint';
type XY = [number, number];
const clearance = houseStair.radius + houseStair.width; // outside edge of the deck door

function edgeDistance([x, y]: XY, [a, b]: readonly [readonly number[], readonly number[]]) {
	const dx = b[0] - a[0],
		dy = b[1] - a[1];
	const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
	return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

/** Reserves a stairwell in the painted union, giving preference to a contiguous occupied bay. */
export function stairBay(cells: readonly QuadCell[]) {
	const bay = footprintBay(cells),
		ids = new Set(cells.map((c) => c.id));
	const sides = cells.flatMap((c) =>
		c.corners.flatMap((a, i) =>
			ids.has(c.neighbors[i] ?? '') ? [] : [[a, c.corners[(i + 1) % 4]] as const]
		)
	);
	const candidates: XY[] = cells.flatMap((c) => [
		[c.center[0], c.center[1]] as XY,
		...c.corners.map(([x, y]): XY => [x, y])
	]);
	const x0 = bay.x - bay.width / 2,
		x1 = bay.x + bay.width / 2,
		y0 = bay.y - bay.depth / 2,
		y1 = bay.y + bay.depth / 2;
	for (const x of [x0 + clearance, bay.x, x1 - clearance])
		for (const y of [y0 + clearance, bay.y, y1 - clearance]) {
			if (x >= x0 && x <= x1 && y >= y0 && y <= y1) candidates.push([x, y]);
		}
	let bestScore = -Infinity;
	let best = { ...bay, axis: [bay.x, bay.y + bay.depth / 2 + clearance] as XY };
	for (const axis of candidates) {
		const [x, y] = axis;
		const dist = Math.min(...sides.map((side) => edgeDistance(axis, side)));
		const blocks = [
			[x0, Math.min(x1, x - clearance), y0, y1],
			[Math.max(x0, x + clearance), x1, y0, y1],
			[x0, x1, y0, Math.min(y1, y - clearance)],
			[x0, x1, Math.max(y0, y + clearance), y1]
		];
		for (const [l, r, b, t] of blocks) {
			const w = r - l,
				d = t - b;
			if (w <= 0 || d <= 0) continue;
			const cx = (l + r) / 2,
				cy = (b + t) / 2;
			const reach = Math.hypot(
				Math.max(0, Math.abs(x - cx) - w / 2),
				Math.max(0, Math.abs(y - cy) - d / 2)
			);
			const score =
				1e5 * Math.min(0, dist - clearance) + Math.log(w * d * Math.min(w, d)) - 0.18 * reach;
			if (score > bestScore) {
				bestScore = score;
				best = { x: cx, y: cy, width: w, depth: d, axis };
			}
		}
	}
	return best;
}

/** Reserves a facade strip for a fixed-width rung ladder on a constrained bay. */
export function ladderBay(cells: readonly QuadCell[]) {
	const bay = footprintBay(cells);
	const strip = Math.min(0.8, bay.depth * 0.28);
	return {
		...bay,
		y: bay.y - strip / 2,
		depth: bay.depth - strip,
		axis: [bay.x, bay.y + bay.depth / 2 - strip * 0.45] as XY
	};
}
