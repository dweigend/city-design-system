import { outline, squaredGap, type Box, type Outline } from './parcel-outline';
import { segmentSeparation } from '../walkway-network';
import { required } from '../required';
import type { TerrainGrid, TerrainCell } from '../terrain-grid';

const minimumSetback = 12;
const maximumSetback = 20;
const minimumGapSquared = minimumSetback ** 2;
const maximumGapSquared = maximumSetback ** 2;
/** Axis-aligned envelope of a surveyed parcel in world metres. */
export function parcelBox(cell: TerrainCell) {
	return outline(cell.corners);
}
function extent(boxes: Box[]): Box {
	return [
		Math.min(...boxes.map((b) => b[0])),
		Math.max(...boxes.map((b) => b[1])),
		Math.min(...boxes.map((b) => b[2])),
		Math.max(...boxes.map((b) => b[3]))
	];
}
type Polygon = [number, number][];
type Plan = {
	court: string;
	mouth: string;
	lots: string[];
	plaza: { cells: string[]; polygon: Polygon; apron: Polygon; bed: Polygon; steps: Polygon };
};
// Wrapped corner bearings at the five green survey points, evaluated only for candidate rings.
function greenBearings(parts: Outline[], box: Box, x: number, y: number) {
	const [a, b, c, d] = box;
	const dx = (a + b) / 2 - x,
		dy = (c + d) / 2 - y;
	return [
		[0, 0],
		[-5, 0],
		[5, 0],
		[0, -5],
		[0, 5]
	].map(([u, v]) => {
		const bearing = Math.atan2(dy - v, dx - u);
		const angles = parts.flatMap((p) =>
			p.edges.map(({ a }) => {
				const delta = Math.atan2(a[1] - y - v, a[0] - x - u) - bearing;
				return bearing + Math.atan2(Math.sin(delta), Math.cos(delta));
			})
		);
		return [Math.min(...angles), bearing, Math.max(...angles)].map(
			(n) => (n + 2 * Math.PI) % (2 * Math.PI)
		);
	});
}

/** Conservative parcel envelopes include the plaza, its mouth, garden and future wing. */
export function clusterSite<T extends Plan>(
	g: T,
	stop: TerrainCell,
	grid: TerrainGrid,
	boxes: Map<string, Outline>,
	reach: ReadonlyMap<string, number>
) {
	const parts = [g.court, ...g.lots].map((id) => required(boxes.get(id), 'cluster footprint'));
	parts.push(
		...[g.plaza.polygon, g.plaza.apron, g.plaza.bed, g.plaza.steps]
			.filter((p) => p.length)
			.map(outline)
	);
	const box = extent(parts.map((p) => p.box)),
		[x, y] = stop.center;
	const [a, b, c, d] = box;
	if (Math.max(x - a, b - x, y - c, d - y) > 95) return;
	let arcs: number[][] | undefined;
	const mouth = required(grid.cellsById.get(g.mouth), 'plaza access').center;
	return {
		g,
		parts,
		box,
		get arcs() {
			return (arcs ??= greenBearings(parts, box, x, y));
		},
		rank:
			(reach.get(g.mouth) ?? 25) * 4 +
			Math.hypot(mouth[0] - x, mouth[1] - y) * 0.15 +
			Number(g.lots.length < 5) * 1.5
	};
}
type Site<T extends Plan> = NonNullable<ReturnType<typeof clusterSite<T>>>;
const gaps = new WeakMap<Outline, WeakMap<Outline, number>>();
function measuredGap(p: Outline, q: Outline) {
	const cached = gaps.get(p)?.get(q) ?? gaps.get(q)?.get(p);
	if (cached !== undefined) return cached;
	const gap = edgeGap(p, q);
	const pairs = gaps.get(p) ?? new WeakMap<Outline, number>();
	pairs.set(q, gap);
	gaps.set(p, pairs);
	return gap;
}
function edgeGap(p: Outline, q: Outline) {
	let best = Infinity;
	for (const a of p.edges)
		for (const b of q.edges) {
			if (squaredGap(a.box, b.box) > Math.min(maximumGapSquared, best * best)) continue;
			best = Math.min(best, segmentSeparation(a, b));
			if (best < minimumSetback) return best;
		}
	return best;
}
function pieceGap(p: Outline, q: Outline, near: boolean) {
	const broad = squaredGap(p.box, q.box);
	if (broad > maximumGapSquared || (near && broad >= minimumGapSquared)) return Infinity;
	return p === q ? 0 : measuredGap(p, q);
}
function compatible<T extends Plan>(a: Site<T>, b: Site<T>) {
	if (
		Math.max(a.box[1], b.box[1]) - Math.min(a.box[0], b.box[0]) > 120 ||
		Math.max(a.box[3], b.box[3]) - Math.min(a.box[2], b.box[2]) > 120
	)
		return false;
	if (squaredGap(a.box, b.box) > maximumGapSquared) return false;
	return setbacks(a.parts, b.parts);
}
function setbacks(left: Outline[], right: Outline[]) {
	let near = false;
	for (const p of left)
		for (const q of right) {
			const gap = pieceGap(p, q, near);
			if (gap < minimumSetback) return false;
			if (gap <= maximumSetback) near = true;
		}
	return near;
}
// A green lies between the building volumes when their convex hull encloses
// an interior point of the green. Parcel centroids alone lose broad corner wings.
function surrounds(sites: { arcs: number[][] }[]) {
	return sites[0].arcs.some((_, k) => {
		const bearings = sites.flatMap((s) => s.arcs[k]).sort((a, b) => a - b);
		return bearings.every((a, i) => (bearings[i + 1] ?? bearings[0] + 2 * Math.PI) - a <= Math.PI);
	});
}
function thirdSite<T extends Plan>(a: Site<T>, b: Site<T>, peers: Site<T>[], start: number) {
	for (let k = start; k < peers.length; k++) {
		const c = peers[k];
		if (compatible(b, c) && surrounds([a, b, c])) return c;
	}
}
function ringGroup<T extends Plan>(a: Site<T>, peers: Site<T>[], limit: number) {
	for (const [j, b] of peers.entries()) {
		const c = thirdSite(a, b, peers, j + 1);
		if (!c) continue;
		const d = limit === 4 && peers.find((p) => compatible(b, p) && compatible(c, p));
		return d ? [a, b, c, d] : [a, b, c];
	}
}
/** Selects adjoining ensembles whose measured setbacks fit around a shared green. */
export function aroundGreen<T extends Plan>(all: Site<T>[], limit: number) {
	const sorted = all.sort((a, b) => a.rank - b.rank);
	let best = sorted.slice(0, 1);
	for (const [i, a] of sorted.entries()) {
		const peers = sorted.slice(0, i).filter((b) => compatible(a, b));
		const group = ringGroup(a, peers, limit);
		if (group) return group.map((s) => s.g);
		const b = best.length < 2 && peers.find((b) => surrounds([a, b]));
		if (b) best = [a, b];
	}
	return best.map((s) => s.g);
}

/** Keeps the next centre's building sites clear of the preceding cluster's courts and wings. */
export function clusterSetback<T extends Plan>(groups: T[], envelopes: Map<string, Outline>) {
	const parts = groups.flatMap((g) => [
		...[g.court, ...g.lots].map((id) => required(envelopes.get(id), 'wing').box),
		...[g.plaza.polygon, g.plaza.bed, g.plaza.apron, g.plaza.steps]
			.filter((p) => p.length)
			.map((p) => outline(p).box)
	]);
	const bounds = extent(parts),
		reserved: string[] = [];
	for (const [id, { box }] of envelopes)
		if (
			squaredGap(bounds, box) < minimumGapSquared &&
			parts.some((p) => squaredGap(p, box) < minimumGapSquared)
		)
			reserved.push(id);
	return reserved;
}
