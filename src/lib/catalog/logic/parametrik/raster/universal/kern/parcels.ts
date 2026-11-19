import { area, length, mix, orient, sub, validateRing } from './geometry';
import { childId, InvariantError, type Vec } from './types';
export type Front = {
	id: string;
	a: Vec;
	b: Vec;
	level: number;
	width: number;
	kind: 'alley' | 'highway';
};
export type Parcel = {
	id: string;
	parent: string | null;
	polygon: Vec[];
	access: { front: string; length: number; level: number }[];
	children: string[];
};
export const cutRatios = [0.5, 0.4, 0.6] as const;
export type ParcelOptions = {
	/** Preferred first cut; both children still need sufficient area and frontage. */
	firstCut?: (typeof cutRatios)[number];
	maxArea: number;
	minArea: number;
	minFront: number;
	minWidth: number;
	maxDepth: number;
	level: number;
};
function frontLength(a: Vec, b: Vec, c: Vec, d: Vec) {
	const u = sub(b, a),
		l = length(u);
	if (!l) return 0;
	// Construction tolerance in meters; identity comes from front IDs, never rounding.
	if (
		Math.abs(u[0] * (c[1] - a[1]) - u[1] * (c[0] - a[0])) > 1e-8 * l ||
		Math.abs(u[0] * (d[1] - a[1]) - u[1] * (d[0] - a[0])) > 1e-8 * l
	)
		return 0;
	const project = (p: Vec) => ((p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1]) / l;
	return Math.max(
		0,
		Math.min(l, Math.max(project(c), project(d))) - Math.max(0, Math.min(project(c), project(d)))
	);
}
export function frontage(p: Vec[], fronts: readonly Front[], o: ParcelOptions) {
	return fronts
		.filter((f) => f.level === o.level && f.width >= o.minWidth)
		.map((f) => ({
			front: f.id,
			level: f.level,
			length: p.reduce((s, a, i) => s + frontLength(a, p[(i + 1) % p.length], f.a, f.b), 0)
		}))
		.filter((f) => f.length >= o.minFront);
}
function clip(p: Vec[], n: Vec, limit: number, sign: number) {
	const out: Vec[] = [];
	for (let i = 0; i < p.length; i++) {
		const a = p[i],
			b = p[(i + 1) % p.length],
			da = sign * (a[0] * n[0] + a[1] * n[1] - limit),
			db = sign * (b[0] * n[0] + b[1] * n[1] - limit);
		if (da <= 0) out.push(a);
		if ((da < 0 && db > 0) || (da > 0 && db < 0)) out.push(mix(a, b, da / (da - db)));
	}
	return out;
}
/** P01: minimum-area oriented box, recursive cuts; both children must retain usable frontage.
 * Convex block only. Access is geometric frontage, not an inferred floorplan door.
 */
export function parcelize(
	root: string,
	polygon: Vec[],
	fronts: readonly Front[],
	o: ParcelOptions
) {
	validateRing(polygon);
	if (
		(o.firstCut !== undefined && !cutRatios.includes(o.firstCut)) ||
		!Object.values({ ...o, firstCut: o.firstCut ?? 0.5 }).every(Number.isFinite) ||
		o.minArea <= 0 ||
		o.maxArea < o.minArea ||
		o.minFront <= 0 ||
		o.minWidth <= 0 ||
		!Number.isInteger(o.maxDepth) ||
		o.maxDepth < 0 ||
		!Number.isInteger(o.level)
	)
		throw new InvariantError('invalid-parcel-options');
	if (
		new Set(fronts.map((f) => f.id)).size !== fronts.length ||
		fronts.some((f) => ![...f.a, ...f.b, f.width, f.level].every(Number.isFinite) || f.width <= 0)
	)
		throw new InvariantError('invalid-front');
	if (
		polygon.some(
			(p, i) => orient(p, polygon[(i + 1) % polygon.length], polygon[(i + 2) % polygon.length]) < 0
		)
	)
		throw new InvariantError('parcel-convex-required');
	const nodes = new Map<string, Parcel>(),
		leaves: Parcel[] = [],
		unresolved: string[] = [];
	function split(id: string, parent: string | null, p: Vec[], depth: number) {
		const a = frontage(p, fronts, o);
		if (!a.length) throw new InvariantError('landlocked', [id]);
		const node: Parcel = { id, parent, polygon: p, access: a, children: [] };
		nodes.set(id, node);
		if (area(p) <= o.maxArea) {
			leaves.push(node);
			return;
		}
		const boxes = p
			.map((v, i) => {
				const d = sub(p[(i + 1) % p.length], v),
					l = length(d),
					n: Vec = [d[0] / l, d[1] / l],
					t: Vec = [-n[1], n[0]];
				const bounds = (axis: Vec) => {
					const vs = p.map((v) => v[0] * axis[0] + v[1] * axis[1]);
					return [Math.min(...vs), Math.max(...vs)];
				};
				const x = bounds(n),
					y = bounds(t);
				return {
					axes: [
						{ n, b: x },
						{ n: t, b: y }
					],
					area: (x[1] - x[0]) * (y[1] - y[0])
				};
			})
			.sort((a, b) => a.area - b.area);
		if (depth < o.maxDepth)
			for (const { n, b } of boxes[0].axes.sort((a, b) => b.b[1] - b.b[0] - (a.b[1] - a.b[0])))
				for (const ratio of depth > 0 || o.firstCut === undefined
					? cutRatios
					: [o.firstCut, ...cutRatios.filter((r) => r !== o.firstCut)]) {
					const limit = b[0] + ratio * (b[1] - b[0]),
						parts = [clip(p, n, limit, 1), clip(p, n, limit, -1)];
					if (
						parts.some((q) => q.length < 3 || area(q) < o.minArea || !frontage(q, fronts, o).length)
					)
						continue;
					node.children = parts.map((_, i) => childId(id, 'parcel', i));
					parts.forEach((q, i) => split(node.children[i], id, q, depth + 1));
					return;
				}
		unresolved.push(id);
		leaves.push(node);
	}
	split(root, null, polygon, 0);
	return { nodes, leaves, unresolved };
}
/** Explicit split/merge lineage; callers migrate overrides, not nearest-center guesses. */
export function parcelRelations(previous: readonly Parcel[], next: readonly Parcel[]) {
	return previous.map((p) => ({
		from: p.id,
		to: next
			.filter(
				(q) =>
					q.id === p.id || q.id.startsWith(p.id + '/parcel:') || p.id.startsWith(q.id + '/parcel:')
			)
			.map((q) => q.id)
			.sort()
	}));
}
