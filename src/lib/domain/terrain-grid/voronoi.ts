import { defaults } from '../../../config/terrain-grid';
import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { encodeKey } from '../../core/ref';
import type { Carrier } from './carrier';
import { axes } from './site';

type CutCorner = Readonly<{ at: Vec2; incoming: string; coincident?: readonly string[] }>;
type SitePoint = Readonly<{ id: string; point: Vec2 }>;
type Corner = Readonly<{ at: Vec2; cuts: readonly string[] }>;
type CellCorners = Readonly<{ id: string; corners: readonly Corner[] }>;

function bisect(polygon: readonly CutCorner[], [x, y]: Vec2, [u, v]: Vec2, cut: string) {
	const signed = ([a, b]: Vec2) => (a - (x + u) / 2) * (u - x) + (b - (y + v) / 2) * (v - y);
	const ring: CutCorner[] = [];
	for (const [i, a] of polygon.entries()) {
		const b = polygon[(i + 1) % polygon.length];
		const da = signed(a.at);
		const db = signed(b.at);
		if (da < 0) ring.push(a);
		if (da === 0) {
			const previous = polygon[(i + polygon.length - 1) % polygon.length];
			ring.push({
				...a,
				incoming: signed(previous.at) > 0 ? cut : a.incoming,
				coincident: [...(a.coincident ?? []), a.incoming, cut]
			});
		}
		if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
			const t = da / (da - db);
			ring.push({
				at: [a.at[0] + t * (b.at[0] - a.at[0]), a.at[1] + t * (b.at[1] - a.at[1])],
				incoming: da < 0 ? b.incoming : cut
			});
		}
	}
	return ring;
}

/** Bisector edges shorter than this fraction of the cell size collapse to their midpoint. */
const shortestEdge = defaults.voronoiMinimumEdgeRatio;

// Keep the previous embedding precision. The clipping constraints provide the addresses.
const bisectorPrecision = defaults.voronoiBisectorPrecision;

type Ring = Readonly<{ id: string; corners: readonly string[] }>;

/** Carries the cut provenance through a cell's clipped polygon. The incoming bound at corner
 * i names the outline edge from corner i−1 to i. */
export function createVoronoiRing(
	site: SitePoint,
	competitors: Iterable<SitePoint>,
	bounds: readonly CutCorner[]
): CellCorners {
	let ring = bounds;
	for (const other of competitors) ring = bisect(ring, site.point, other.point, other.id);
	return {
		id: 'site/' + site.id,
		corners: ring.map(({ at, incoming, coincident }, index) => ({
			at,
			cuts: [site.id, incoming, ring[(index + 1) % ring.length].incoming, ...(coincident ?? [])]
		}))
	};
}

type Weld = { at: Vec2; cuts: Set<string> };

function coincides([x, y]: Vec2, [u, v]: Vec2) {
	const tolerance =
		/* Exact arithmetic: roundoff allowance for adjacent bisector evaluations. */ 64 *
		Number.EPSILON *
		Math.max(1, Math.abs(x), Math.abs(y), Math.abs(u), Math.abs(v));
	return Math.max(Math.abs(x - u), Math.abs(y - v)) <= tolerance;
}

const bucketOffsets = /* Exact arithmetic: 3x3 neighbor bucket offsets. */ [-1, 0, 1] as const;

/** Position buckets find coincident occurrences across cell rings. The complete incident
 * set names each weld. Coordinates are used only for the embedding and to find candidates. */
export function weldVoronoiRings(cells: readonly CellCorners[]) {
	const buckets = new Map<string, Weld[]>();
	function weld({ at, cuts }: Corner) {
		const [x, y] = at.map((value) => Math.floor(value * bisectorPrecision));
		for (const dy of bucketOffsets)
			for (const dx of bucketOffsets) {
				const match = buckets
					.get(encodeKey([x + dx, y + dy]))
					?.find((entry) => coincides(entry.at, at));
				if (!match) continue;
				for (const cut of cuts) match.cuts.add(cut);
				return match;
			}
		const entry = { at, cuts: new Set(cuts) };
		const key = encodeKey([x, y]);
		let bucket = buckets.get(key);
		if (!bucket) buckets.set(key, (bucket = []));
		bucket.push(entry);
		return entry;
	}
	const welded = cells.map(({ id, corners }) => ({ id, corners: corners.map(weld) }));
	const points = new Map<string, Vec2>();
	const rings = welded.map(({ id, corners }) => ({
		id,
		corners: [
			...new Set(
				corners.map(({ at, cuts }) => {
					const key = 'bisector/' + encodeKey([...cuts].sort());
					if (!points.has(key))
						points.set(key, [
							Math.round(at[0] * bisectorPrecision) / bisectorPrecision,
							Math.round(at[1] * bisectorPrecision) / bisectorPrecision
						]);
					return key;
				})
			)
		]
	}));
	return { rings, points };
}

/** Unions the two ends of every short edge and returns each address's cluster midpoint, so
 * every cell that shares a vertex moves it alike and no sliver face remains. */
function collapseShortEdges(rings: readonly Ring[], points: ReadonlyMap<string, Vec2>) {
	const parent = new Map([...points.keys()].map((id) => [id, id]));
	const find = (id: string): string => {
		const up = parent.get(id) ?? id;
		if (up === id) return id;
		const root = find(up);
		parent.set(id, root);
		return root;
	};
	for (const { corners } of rings) {
		corners.forEach((a, index) => {
			const b = corners[(index + 1) % corners.length];
			const [ax, ay] = points.get(a) ?? /* Exact arithmetic: fallback site origin. */ [0, 0];
			const [bx, by] = points.get(b) ?? /* Exact arithmetic: fallback site origin. */ [0, 0];
			if (Math.hypot(bx - ax, by - ay) < shortestEdge) parent.set(find(a), find(b));
		});
	}
	const clusters = new Map<string, string[]>();
	for (const id of points.keys()) clusters.set(find(id), [...(clusters.get(find(id)) ?? []), id]);
	const merged = new Map<string, Readonly<{ id: string; at: Vec2 }>>();
	for (const members of clusters.values()) {
		const id = [...members].sort()[0];
		const at = members.reduce<Vec2>(
			([x, y], member) => {
				const [u, v] = points.get(member) ?? /* Exact arithmetic: fallback site origin. */ [0, 0];
				return [x + u / members.length, y + v / members.length];
			},
			/* Exact arithmetic: initial sum of XY coordinates. */ [0, 0]
		);
		for (const member of members) merged.set(member, { id, at });
	}
	return merged;
}

export const voronoi: Carrier = function* (site, outline, bearing, size, random) {
	const { toLocal, toWorld } = axes(bearing);
	const local = outline.map(([x, y]) =>
		toLocal((x - site.origin[0]) / size, (y - site.origin[1]) / size)
	);
	const columns = local.map(([x]) => x);
	const rows = local.map(([, y]) => y);
	const sites = new Map<string, Vec2>();
	function seedPoint(i: number, j: number): Vec2 {
		const key = encodeKey([i, j]);
		const current = sites.get(key);
		if (current) return current;
		const stream = random.derive(`${i},${j}`);
		const offset = { min: -defaults.voronoiJitterRatio, max: defaults.voronoiJitterRatio };
		const point: Vec2 = [i + stream.number(offset), j + stream.number(offset)];
		sites.set(key, point);
		return point;
	}
	const cells: CellCorners[] = [];
	// A margin of two sites completes every short-edge cluster of a cell inside the outline.
	for (
		let j = Math.floor(Math.min(...rows)) - defaults.voronoiSearchRadius;
		j <= Math.ceil(Math.max(...rows)) + defaults.voronoiSearchRadius;
		j++
	) {
		for (
			let i = Math.floor(Math.min(...columns)) - defaults.voronoiSearchRadius;
			i <= Math.ceil(Math.max(...columns)) + defaults.voronoiSearchRadius;
			i++
		) {
			const center = seedPoint(i, j);
			const generator = `${i},${j}`;
			const bounds: Vec2[] = [
				[i - defaults.voronoiSearchRadius, j - defaults.voronoiSearchRadius],
				[i + defaults.voronoiSearchRadius, j - defaults.voronoiSearchRadius],
				[i + defaults.voronoiSearchRadius, j + defaults.voronoiSearchRadius],
				[i - defaults.voronoiSearchRadius, j + defaults.voronoiSearchRadius]
			];
			// Only complete cells survive the search halo and whole-cell site crop.
			const outline = bounds.map((at, side) => ({ at, incoming: `guard/${side}` }));
			// Fixed local competitors keep every cell independent of the crop.
			const competitors: SitePoint[] = [];
			for (let v = -defaults.voronoiSearchRadius; v <= defaults.voronoiSearchRadius; v++) {
				for (let u = -defaults.voronoiSearchRadius; u <= defaults.voronoiSearchRadius; u++) {
					if (!u && !v) continue;
					competitors.push({ id: `${i + u},${j + v}`, point: seedPoint(i + u, j + v) });
				}
			}
			cells.push(createVoronoiRing({ id: generator, point: center }, competitors, outline));
		}
	}
	const { rings, points } = weldVoronoiRings(cells);
	const merged = collapseShortEdges(rings, points);
	for (const { id, corners } of rings) {
		const nodes = new Map(
			corners.map((corner) => {
				const { id: address, at } = required(merged.get(corner), 'welded Voronoi corner');
				const [u, v] = toWorld(at[0] * size, at[1] * size);
				return [address, { id: address, xy: [site.origin[0] + u, site.origin[1] + v] as const }];
			})
		);
		yield { id, corners: [...nodes.values()] };
	}
};
