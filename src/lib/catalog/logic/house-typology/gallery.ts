import { boundaryRings, ringArea, type QuadCell } from '../quad-grid';
import type { Survey } from './survey';

type XY = [number, number];

/** Reserves neighbouring frontages for a continuous podium where a street meets narrow or compound plots. */
export function frontages(sites: Survey[]) {
	const owner = new Map(sites.flatMap((s) => s.cells.map((c) => [c.id, s] as const)));
	const street = sites.some(
		(s) =>
			s.compact ||
			s.cells.length > 1 ||
			s.ground !== sites[0].ground ||
			s.width !== sites[0].width ||
			s.depth !== sites[0].depth
	);
	return new Map(
		sites.map((site) => {
			const edges = site.cells.flatMap((c) =>
				c.neighbors.filter((id): id is string => {
					const other = id && owner.get(id);
					return !!other && other !== site;
				})
			);
			const narrowWing = site.compact && site.cells.length > 1;
			return [
				site.id,
				(street && edges.length) || narrowWing ? new Set(edges) : undefined
			] as const;
		})
	);
}

/** Centreline rooms follow the shortest cell paths from the access tower to its party walls. */
export function galleryPlot(
	cells: readonly QuadCell[],
	neighbors: ReadonlySet<string>,
	root: QuadCell
) {
	const byId = new Map(cells.map((c) => [c.id, c]));
	const parent = new Map<string, string>([[root.id, root.id]]);
	const queue = [root],
		route = new Set([root.id]);
	for (const c of queue) {
		for (const id of c.neighbors) {
			const next = id && byId.get(id);
			if (!next || parent.has(next.id)) continue;
			parent.set(next.id, c.id);
			queue.push(next);
		}
	}
	for (const c of cells.filter((c) => c.neighbors.some((id) => id && neighbors.has(id)))) {
		let id = c.id;
		while (!route.has(id)) {
			route.add(id);
			id = parent.get(id) ?? root.id;
		}
	}
	const selected = cells.filter((c) => route.has(c.id));
	const [polygon, ...holes] = boundaryRings(selected, (id) => route.has(id)).sort(
		(a, b) => ringArea(b) - ringArea(a)
	);
	if (selected.length !== 1) return { polygon, holes };
	// Chamfer each end of an occupied span. The middle of every party face stays flush.
	const ring = selected[0].corners;
	const chamfer = ring.flatMap(([x, y], i) =>
		[ring[(i + 3) % 4], ring[(i + 1) % 4]].map(([a, b]): XY => [
			x + 0.28 * (a - x),
			y + 0.28 * (b - y)
		])
	);
	return { polygon: chamfer, holes };
}
