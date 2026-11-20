import { boundaryRings, ringArea, type QuadCell } from '../quad-grid';
import { STORY } from '../../data/grid';
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

function galleryNeighbours(
	first: Survey,
	pending: Set<Survey>,
	walls: ReturnType<typeof frontages>
) {
	const group = [first];
	pending.delete(first);
	for (const site of group) {
		const edges = walls.get(site.id);
		for (const next of pending) {
			if (!Number.isInteger((next.ground - first.ground) / STORY)) continue;
			if (!next.cells.some((cell) => edges?.has(cell.id))) continue;
			pending.delete(next);
			group.push(next);
		}
	}
	return group;
}

/** Selects a common walking elevation for opposing upper galleries on compatible foundations. */
export function galleryCourses(sites: Survey[], walls: ReturnType<typeof frontages>) {
	const pending = new Set(sites.filter((s) => s.programme.length >= 5 && walls.get(s.id)?.size));
	const courses = new Map<string, number>();
	for (const first of pending) {
		const group = galleryNeighbours(first, pending, walls);
		if (group.length < 2) continue;
		const low = Math.max(...group.map((s) => s.ground + 3 * STORY));
		const top = Math.min(...group.map((s) => s.ground + (s.programme.length - 1) * STORY));
		const target = Math.min(
			...group.map((s) => s.ground + Math.ceil(s.programme.length / 2) * STORY)
		);
		if (low <= top)
			for (const s of group) courses.set(s.id, (Math.max(low, target) - s.ground) / STORY);
	}
	return courses;
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
