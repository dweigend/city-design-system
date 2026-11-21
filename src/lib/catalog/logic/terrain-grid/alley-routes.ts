import { MODULE } from './contour-rows';
import { corridorCost, groundRouteWidth } from './alley-plan';
import type { TerrainCell, TerrainGrid } from './types';

type Profile = TerrainGrid['profile'];
export type GroundRoute = {
	kind: 'arterial' | 'street' | 'alley';
	widthM: number;
	cellIds: readonly string[];
};

type Cells = ReadonlyMap<string, TerrainCell>;
type Search = { cost: Map<string, number>; parent: Map<string, string> };
type Links = ReadonlyMap<string, readonly string[]>;

// Allow slight drift on the contour, but give long frontages a real change of bearing.
// Any two steps within 15 degrees of one bearing differ by at most 30 degrees.
const STRAIGHT_COS = Math.cos(Math.PI / 6);
const MAX_STRAIGHT_RUN_M = 32;

function straightFrom(
	cells: Cells,
	last: TerrainCell,
	first: TerrainCell,
	previous: (id: string) => readonly string[]
) {
	const dx = last.center[0] - first.center[0];
	const dy = last.center[1] - first.center[1];
	const length = Math.hypot(dx, dy);
	function withinRun(from: TerrainCell, to: TerrainCell, run: number): boolean {
		const x = to.center[0] - from.center[0];
		const y = to.center[1] - from.center[1];
		const step = Math.hypot(x, y);
		if (dx * x + dy * y < STRAIGHT_COS * length * step) return true;
		if (run + step > MAX_STRAIGHT_RUN_M) return false;
		return previous(from.id).every((id) => {
			const before = cells.get(id);
			return !before || before === to || withinRun(before, from, run + step);
		});
	}
	return withinRun(first, last, 0);
}

function takeLowest(pending: Map<string, number>) {
	let best = Infinity;
	let id = '';
	for (const [candidate, distance] of pending) {
		if (distance >= best) continue;
		best = distance;
		id = candidate;
	}
	pending.delete(id);
	return { id, best };
}

function survey(
	cells: Cells,
	sources: ReadonlySet<string>,
	profile: Profile,
	kind: GroundRoute['kind'],
	blocked: ReadonlySet<string>,
	links: Links,
	goal?: string
): Search {
	const pending = new Map([...sources].map((id) => [id, 0]));
	const cost = new Map(pending);
	const parent = new Map<string, string>();
	const previous = (id: string) => {
		const link = parent.get(id);
		return link === undefined ? (links.get(id) ?? []) : [link];
	};
	while (pending.size > 0) {
		const { id, best } = takeLowest(pending);
		if (id === goal) break;
		const cell = cells.get(id);
		if (!cell) continue;
		for (const [side, neighbor] of cell.neighbors.entries()) {
			if (neighbor === null || blocked.has(neighbor)) continue;
			const next = cells.get(neighbor);
			if (!next) continue;
			const distance = best + corridorCost(cell, next, side, kind, profile);
			if (distance >= (cost.get(neighbor) ?? Infinity)) continue;
			if (!straightFrom(cells, next, cell, previous)) continue;
			cost.set(neighbor, distance);
			pending.set(neighbor, distance);
			parent.set(neighbor, id);
		}
	}
	return { cost, parent };
}

function trace(search: Search, target: string) {
	if (!search.cost.has(target)) return [];
	const path = [target];
	for (let id = search.parent.get(target); id !== undefined; id = search.parent.get(id))
		path.push(id);
	return path.reverse();
}

function newFrontage(cells: Cells, route: readonly string[], served: ReadonlySet<string>) {
	const frontage = new Set<string>();
	for (const id of route.slice(1))
		for (const n of cells.get(id)?.neighbors ?? [])
			if (n !== null && cells.has(n) && !served.has(n) && !route.includes(n)) frontage.add(n);
	return frontage.size;
}

function localTarget(
	cells: Cells,
	search: Search,
	network: ReadonlySet<string>,
	remaining: number,
	profile: Profile
) {
	const served = new Set(network);
	for (const id of network)
		for (const neighbor of cells.get(id)?.neighbors ?? [])
			if (neighbor !== null) served.add(neighbor);
	let best = 0;
	let target: TerrainCell | undefined;
	for (const cell of cells.values()) {
		const cost = search.cost.get(cell.id) ?? 0;
		// A local street serves the next group of plots, with tighter spacing on the slope.
		const reach = cell.pattern === 'contour' ? 4 * MODULE : 6 * MODULE;
		if (cost < 1.5 * MODULE || cost > reach) continue;
		const route = trace(search, cell.id);
		if (route.length - 1 > remaining) continue;
		const frontage = newFrontage(cells, route, served);
		if (!frontage) continue;
		const preferred = cell.plan.kind === 'mainAlley' ? profile.mainAlleyWidth / MODULE : 0;
		const score = (frontage / (route.length - 1) + preferred) * (cost / reach);
		if (score <= best) continue;
		best = score;
		target = cell;
	}
	return target;
}

/** Connects the surveyed arterial and local destinations on the dry carrier. Cells are read in
 * carrier order, links in side order, and plaza and court reserves are excluded from routing. */
export function surveyGroundRoutes(
	cells: Cells,
	profile: Profile,
	start: string,
	gate: string,
	oldTown: string,
	blocked: ReadonlySet<string>
): readonly GroundRoute[] {
	const links = new Map<string, string[]>();
	const network = new Set<string>();
	const routes: GroundRoute[] = [];
	function add(kind: GroundRoute['kind'], cellIds: string[]) {
		const widthM = groundRouteWidth(kind, profile);
		routes.push({ kind, widthM, cellIds });
		for (const [i, id] of cellIds.entries()) {
			network.add(id);
			if (i === 0) continue;
			const before = cellIds[i - 1];
			links.set(before, [...(links.get(before) ?? []), id]);
			links.set(id, [...(links.get(id) ?? []), before]);
		}
	}
	const arterial = trace(
		survey(cells, new Set([gate]), profile, 'arterial', blocked, links, start),
		start
	);
	add('arterial', arterial.length ? arterial.reverse() : [gate]);
	const firstStreet = trace(
		survey(cells, network, profile, 'street', blocked, links, oldTown),
		oldTown
	);
	if (firstStreet.length > 1) add('street', firstStreet);
	const budget = Math.floor(cells.size * 0.21);
	while (network.size < budget) {
		const search = survey(cells, network, profile, 'street', blocked, links);
		const target = localTarget(cells, search, network, budget - network.size, profile);
		if (!target) break;
		const cellIds = trace(search, target.id);
		const kind = target.plan.stairAlley || cellIds.length <= 3 ? 'alley' : 'street';
		add(kind, cellIds);
	}
	return routes;
}
