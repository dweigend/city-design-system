import { defaults } from '../../../config/terrain-grid';
import type { Vec2 } from '../../core/geometry';
import { encodeKey } from '../../core/ref';
import type { Carrier } from './carrier';
import { axes } from './site';

type CutCorner = Readonly<{ at: Vec2; incoming: string }>;

function bisect(polygon: readonly CutCorner[], [x, y]: Vec2, [u, v]: Vec2, cut: string) {
	const signed = ([a, b]: Vec2) => (a - (x + u) / 2) * (u - x) + (b - (y + v) / 2) * (v - y);
	const ring: CutCorner[] = [];
	for (const [i, a] of polygon.entries()) {
		const b = polygon[(i + 1) % polygon.length];
		const da = signed(a.at);
		const db = signed(b.at);
		if (da <= 0) {
			const previous = polygon[(i + polygon.length - 1) % polygon.length];
			ring.push(da === 0 && signed(previous.at) > 0 ? { ...a, incoming: cut } : a);
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
	const rings: Ring[] = [];
	const points = new Map<string, Vec2>();
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
			let ring = bounds.map((at, side) => ({ at, incoming: `guard/${side}` }));
			// Fixed local competitors keep every cell independent of the crop.
			for (let v = -defaults.voronoiSearchRadius; v <= defaults.voronoiSearchRadius; v++) {
				for (let u = -defaults.voronoiSearchRadius; u <= defaults.voronoiSearchRadius; u++) {
					if (!u && !v) continue;
					const point = seedPoint(i + u, j + v);
					ring = bisect(ring, center, point, `${i + u},${j + v}`);
				}
			}
			const corners = ring.map(({ at, incoming }, index) => {
				const outgoing = ring[(index + 1) % ring.length].incoming;
				const id = 'bisector/' + encodeKey([generator, incoming, outgoing].sort());
				if (!points.has(id))
					points.set(
						id,
						at.map((value) => Math.round(value * bisectorPrecision) / bisectorPrecision) as [
							number,
							number
						]
					);
				return id;
			});
			rings.push({ id: `site/${i},${j}`, corners: [...new Set(corners)] });
		}
	}
	const merged = collapseShortEdges(rings, points);
	for (const { id, corners } of rings) {
		const nodes = new Map(
			corners.map((corner) => {
				const { id: address, at } = merged.get(corner) ?? {
					id: corner,
					at: /* Exact arithmetic: fallback site origin. */ [0, 0]
				};
				const [u, v] = toWorld(at[0] * size, at[1] * size);
				return [address, { id: address, xy: [site.origin[0] + u, site.origin[1] + v] as const }];
			})
		);
		yield { id, corners: [...nodes.values()] };
	}
};
