import type { StockPart } from './house-object';
import { planPoints } from './part-plan';
type XY = [number, number];
export type Footprint = { ring: XY[]; holes: XY[][] };
export const cantileverMargin = 0.6;
/** Convex hull in counter-clockwise order (monotone chain). */
function hull(points: XY[]) {
	const sorted = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
	const turn = (o: XY, a: XY, b: XY) =>
		(a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const half = (list: XY[]) => {
		const chain: XY[] = [];
		for (const p of list) {
			while (chain.length > 1 && turn(chain[chain.length - 2], chain[chain.length - 1], p) <= 0)
				chain.pop();
			chain.push(p);
		}
		return chain.slice(0, -1);
	};
	return [...half(sorted), ...half(sorted.reverse())];
}
/** Plan footprint of a part: a prism keeps its own outline and holes, any other kind its hull. */
export function footprint(p: StockPart): Footprint {
	const plan = planPoints(p) as XY[];
	return p.kind === 'prism'
		? { ring: plan, holes: p.holes ?? [] }
		: { ring: hull(plan), holes: [] };
}
type Corners = readonly (readonly number[])[];

/** Signed doubled area of the oriented triangle in square metres. */
export function side(a: readonly number[], b: readonly number[], p: readonly number[]) {
	return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}
function area(ring: Corners) {
	return ring.slice(2).reduce((sum, p, i) => sum + side(ring[0], ring[i + 1], p) / 2, 0);
}
function split(ring: XY[], distance: (p: XY) => number) {
	const inside: XY[] = [],
		outside: XY[] = [];
	for (const [i, a] of ring.entries()) {
		const b = ring[(i + 1) % ring.length],
			u = distance(a),
			v = distance(b);
		(u >= 0 ? inside : outside).push(a);
		if (u >= 0 === v >= 0) continue;
		const t = u / (u - v);
		const cut: XY = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
		inside.push(cut);
		outside.push(cut);
	}
	return { inside, outside };
}
function subtractCell(ring: XY[], corners: Corners, margin: number) {
	const rest: XY[][] = [];
	const sign = Math.sign(area(corners));
	for (const [i, a] of corners.entries()) {
		const b = corners[(i + 1) % corners.length];
		const offset = margin * Math.hypot(b[0] - a[0], b[1] - a[1]);
		const { inside, outside } = split(ring, (p) => sign * side(a, b, p) + offset);
		if (outside.length >= 3) rest.push(outside);
		ring = inside;
		if (ring.length < 3) break;
	}
	return rest;
}
/** Subtracts the union of margin-offset convex cells from the occupied footprint, in square metres. */
export function plotCovers(
	cells: readonly { corners: Corners }[],
	shape: Footprint,
	margin: number
) {
	function uncovered(ring: XY[]) {
		let pieces = [ring];
		for (const cell of cells) pieces = pieces.flatMap((r) => subtractCell(r, cell.corners, margin));
		return pieces.reduce((total, piece) => total + Math.abs(area(piece)), 0);
	}
	return (
		uncovered(shape.ring) - shape.holes.reduce((sum, hole) => sum + uncovered(hole), 0) <= 1e-6
	);
}
