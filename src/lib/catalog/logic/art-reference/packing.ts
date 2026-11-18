import { hash } from '../hash-random';
import { defineParams, numberParam, resolveParams, type ParamOverrides } from '../params';
export type Cell = readonly (readonly [number, number])[];
type Disc = { x: number; y: number; radius: number };
const collageParams = defineParams({
	count: numberParam('Fragments', 'pieces', 12, [1, 32, 1], 'integer'),
	fill: numberParam('Occupied radius', 'ratio', 0.82, [0.25, 0.96, 0.01])
});
function clearance(cell: Cell, x: number, y: number) {
	let inside = false,
		distance = Infinity;
	for (const [i, [ax, ay]] of cell.entries()) {
		const [bx, by] = cell[(i + 1) % cell.length];
		const dx = bx - ax,
			dy = by - ay;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
		distance = Math.min(distance, Math.hypot(x - ax - t * dx, y - ay - t * dy));
		if (ay > y !== by > y && x < ax + ((y - ay) * dx) / dy) inside = !inside;
	}
	return inside ? distance : 0;
}
function bounds(cell: Cell) {
	const xs = cell.map(([x]) => x),
		ys = cell.map(([, y]) => y);
	return {
		left: Math.min(...xs),
		bottom: Math.min(...ys),
		width: Math.max(...xs) - Math.min(...xs),
		height: Math.max(...ys) - Math.min(...ys)
	};
}
function bestCandidate(cell: Cell, box: ReturnType<typeof bounds>, placed: Disc[], seed: number) {
	let best: Disc = { x: 0, y: 0, radius: 0 };
	for (let i = 0; i < 256; i++) {
		const id = placed.length * 256 + i;
		const x = box.left + hash(seed, id, 0) * box.width,
			y = box.bottom + hash(seed, id, 1) * box.height;
		let radius = clearance(cell, x, y);
		for (const p of placed) radius = Math.min(radius, Math.hypot(x - p.x, y - p.y) - p.radius);
		if (radius > best.radius) best = { x, y, radius };
	}
	return best;
}
/** Pack a simple hole-free ring (metres). V1 samples 256 candidates per fragment,
 * channels 0/1 for XY, 2 for radians, 3 for height. Stops below 1 mm and can miss thin cells.
 */
export function composeCollage(
	cell: Cell,
	seed: number,
	overrides?: ParamOverrides<typeof collageParams>
) {
	const { count, fill } = resolveParams(collageParams, undefined, overrides);
	const pieces: (Disc & { angle: number; height: number })[] = [];
	const box = bounds(cell);
	for (let id = 0; id < count && cell.length >= 3; id++) {
		const candidate = bestCandidate(cell, box, pieces, seed);
		if (candidate.radius * fill < 0.001) break;
		pieces.push({
			...candidate,
			radius: candidate.radius * fill,
			angle: (hash(seed, id, 2) - 0.5) * 0.42,
			height: candidate.radius * (0.65 + hash(seed, id, 3))
		});
	}
	return pieces;
}
