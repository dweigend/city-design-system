import { distance, type Vec2 } from '../../core/geometry';
import type { Carrier } from './carrier';
import { axes } from './site';

function bisect(polygon: readonly Vec2[], [x, y]: Vec2, [u, v]: Vec2) {
	const signed = ([a, b]: Vec2) => (a - (x + u) / 2) * (u - x) + (b - (y + v) / 2) * (v - y);
	const ring: Vec2[] = [];
	for (const [i, a] of polygon.entries()) {
		const b = polygon[(i + 1) % polygon.length];
		const da = signed(a);
		const db = signed(b);
		if (da <= 0) ring.push(a);
		if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
			const t = da / (da - db);
			ring.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
		}
	}
	return ring;
}

/** Bisector edges shorter than this fraction of the cell size collapse to their midpoint. */
const shortestEdge = 0.125;

// Weld independently evaluated bisectors to one position at the existing submicron precision.
const bisectorPrecision = 1e8;
type GeneratingSite = { id: string; point: Vec2 };

function cornerAddress(point: Vec2, sites: readonly GeneratingSite[]) {
	const distances = sites.map((site) => ({ id: site.id, radius: distance(site.point, point) }));
	const nearest = Math.min(...distances.map(({ radius }) => radius));
	const incident = distances
		.filter(({ radius }) => radius - nearest <= 1 / bisectorPrecision)
		.map(({ id }) => id)
		.sort();
	return 'bisector/' + JSON.stringify(incident);
}

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
			const [ax, ay] = points.get(a) ?? [0, 0];
			const [bx, by] = points.get(b) ?? [0, 0];
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
				const [u, v] = points.get(member) ?? [0, 0];
				return [x + u / members.length, y + v / members.length];
			},
			[0, 0]
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
		const key = `${i},${j}`;
		const current = sites.get(key);
		if (current) return current;
		const stream = random.derive(key);
		const offset = { min: -0.22, max: 0.22 };
		const point: Vec2 = [i + stream.number(offset), j + stream.number(offset)];
		sites.set(key, point);
		return point;
	}
	const rings: Ring[] = [];
	const points = new Map<string, Vec2>();
	// A margin of two sites completes every short-edge cluster of a cell inside the outline.
	for (let j = Math.floor(Math.min(...rows)) - 2; j <= Math.ceil(Math.max(...rows)) + 2; j++) {
		for (
			let i = Math.floor(Math.min(...columns)) - 2;
			i <= Math.ceil(Math.max(...columns)) + 2;
			i++
		) {
			const center = seedPoint(i, j);
			const generators = [{ id: `${i},${j}`, point: center }];
			let ring: Vec2[] = [
				[i - 2, j - 2],
				[i + 2, j - 2],
				[i + 2, j + 2],
				[i - 2, j + 2]
			];
			// Fixed local competitors keep every cell independent of the crop.
			for (let v = -2; v <= 2; v++) {
				for (let u = -2; u <= 2; u++) {
					if (!u && !v) continue;
					const point = seedPoint(i + u, j + v);
					generators.push({ id: `${i + u},${j + v}`, point });
					ring = bisect(ring, center, point);
				}
			}
			const corners = ring.map((point) => {
				const id = cornerAddress(point, generators);
				if (!points.has(id))
					points.set(
						id,
						point.map((value) => Math.round(value * bisectorPrecision) / bisectorPrecision) as [
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
				const { id: address, at } = merged.get(corner) ?? { id: corner, at: [0, 0] };
				const [u, v] = toWorld(at[0] * size, at[1] * size);
				return [address, { id: address, xy: [site.origin[0] + u, site.origin[1] + v] as const }];
			})
		);
		yield { id, corners: [...nodes.values()] };
	}
};
