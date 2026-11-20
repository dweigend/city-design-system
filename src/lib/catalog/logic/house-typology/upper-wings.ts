import { convexHull } from '../parzelle';
import type { Survey } from './survey';
import type { QuadCell } from '../quad-grid';

export type UpperWing = {
	level: number;
	walls: Set<string>;
	abutments: Set<string>;
};
function neighbours(site: Survey, pending: Set<Survey>) {
	const adjacent = new Set(site.cells.flatMap((c) => c.neighbors));
	return [...pending].filter(
		(s) => s.ground === site.ground && s.cells.some((c) => adjacent.has(c.id))
	);
}
function takeWing(pending: Set<Survey>, count: number) {
	const first = [...pending].sort(
		(a, b) => neighbours(a, pending).length - neighbours(b, pending).length
	)[0];
	const members = [first];
	pending.delete(first);
	for (const member of members)
		for (const next of neighbours(member, pending)) {
			if (members.length === count) return members;
			pending.delete(next);
			members.push(next);
		}
	return members;
}
function divideWing(group: Survey[], result: Map<string, UpperWing>, sites: Survey[]) {
	const lowest = Math.min(...group.map((s) => s.programme.length));
	if (group.length < 2 || lowest >= 5) return;
	const level = Math.min(2, lowest - 1);
	const remaining = new Set(group);
	while (remaining.size) {
		const wing = takeWing(remaining, remaining.size === 4 || group.length === 3 ? 2 : 3);
		for (const site of wing) {
			const abutments = sites
				.filter((s) => s.ground !== site.ground)
				.flatMap((s) => s.cells.map((c) => c.id));
			result.set(site.id, {
				level,
				abutments: new Set(abutments),
				walls: new Set(wing.filter((n) => n !== site).flatMap((n) => n.cells.map((c) => c.id)))
			});
		}
	}
}
/** Assigns upper galleries to connected wings. */
export function upperWings(sites: Survey[], frontages: Map<string, Set<string> | undefined>) {
	const result = new Map<string, UpperWing>();
	const pending = new Set(
		sites.filter((s) => frontages.get(s.id)?.size && s.programme.length >= 2)
	);
	while (pending.size) divideWing(takeWing(pending, Infinity), result, sites);
	return result;
}
type XY = [number, number];
/** Extends a core to the middle of each shared face while leaving the outside corners open. */
export function wingRim(cell: QuadCell, walls: ReadonlySet<string>, pier: XY[]) {
	const ends = cell.corners.flatMap(([x, y], i) => {
		if (!walls.has(cell.neighbors[i] ?? '')) return [];
		const [u, v] = cell.corners[(i + 1) % 4];
		return [0.19, 0.81].map((t) => [x + (u - x) * t, y + (v - y) * t] as XY);
	});
	return convexHull([...pier, ...ends]).map(([x, y]): XY => [x, y]);
}
