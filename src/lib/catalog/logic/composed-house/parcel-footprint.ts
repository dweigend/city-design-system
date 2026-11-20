import type { StockPart } from './house-object';
import { planPoints } from './part-plan';
type XY = [number, number];
import type { Footprint } from '../parzelle';
export type { Footprint } from '../parzelle';
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
export { plotCovers, side } from '../parzelle';
