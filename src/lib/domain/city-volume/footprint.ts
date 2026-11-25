import { defaults } from '../../../config/city-volume';
import { measurePolygon, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { TerrainGrid, TerrainGridCell } from '../terrain-grid';

function sampleCells(grid: TerrainGrid, cost: (center: Vec2, grade: number) => number) {
	const points = new Map(grid.vertices.map(({ id, position }) => [id, position]));
	return grid.cells
		.map((cell, index) => {
			const ring = cell.vertexIds.map((id) => required(points.get(id), 'growth vertex'));
			const { area } = measurePolygon(ring);
			let x = 0;
			let y = 0;
			let grade = 0;
			for (const [i, [ax, ay, az]] of ring.entries()) {
				const [bx, by, bz] = ring[(i + 1) % ring.length];
				x += ax / ring.length;
				y += ay / ring.length;
				grade = Math.max(grade, Math.abs(bz - az) / Math.hypot(bx - ax, by - ay));
			}
			return { cell, index, area, cost: cost([x, y], grade) };
		})
		.sort((a, b) => a.cost - b.cost || a.index - b.index);
}

function components() {
	const parent = new Map<string, string>();
	function root(id: string) {
		let current = id;
		while (parent.get(current) !== current) current = required(parent.get(current), 'part root');
		parent.set(id, current);
		return current;
	}
	return {
		has: (id: string) => parent.has(id),
		root,
		add(id: string, roots: ReadonlySet<string>) {
			parent.set(id, id);
			for (const other of roots) parent.set(other, id);
		}
	};
}

function admission() {
	const attached = components();
	const cornerOwners = new Map<string, string>();
	return (cell: TerrainGridCell) => {
		const sides = cell.neighbors.flatMap((id) =>
			id !== null && attached.has(id) ? [attached.root(id)] : []
		);
		const roots = new Set(sides);
		let newCorners = 0;
		for (const vertex of cell.vertexIds) {
			const owner = cornerOwners.get(vertex);
			if (owner === undefined) newCorners++;
			else if (!roots.has(attached.root(owner))) return false;
		}
		// Adding a face changes Euler characteristic by newVertices - newEdges + 1.
		// Its component count changes by 1 - joinedParts. Equality prevents every new hole.
		if (newCorners - (cell.vertexIds.length - sides.length) !== -roots.size) return false;
		attached.add(cell.id, roots);
		for (const vertex of cell.vertexIds) cornerOwners.set(vertex, cell.id);
		return true;
	};
}

function waitingByCorner(proposals: ReturnType<typeof sampleCells>) {
	const waiting = new Map<string, Set<number>>();
	return {
		add(index: number) {
			for (const vertex of proposals[index].cell.vertexIds) {
				const queue = waiting.get(vertex) ?? new Set<number>();
				queue.add(index);
				waiting.set(vertex, queue);
			}
		},
		ready(cell: TerrainGridCell, retries: Set<number>) {
			for (const vertex of cell.vertexIds) {
				for (const index of waiting.get(vertex) ?? []) retries.add(index);
			}
		},
		delete(index: number) {
			for (const vertex of proposals[index].cell.vertexIds) waiting.get(vertex)?.delete(index);
		}
	};
}

function partEntries(proposals: ReturnType<typeof sampleCells>, minimumArea: number) {
	const byId = new Map(proposals.map(({ cell }, index) => [cell.id, index]));
	const part = new Int32Array(proposals.length).fill(
		/* Exact arithmetic: unassigned region sentinel. */ -1
	);
	const areas = new Map<number, number>();
	for (const start of proposals.keys()) {
		if (part[start] !== -1) continue;
		let area = 0;
		const queue = [start];
		part[start] = start;
		for (const i of queue) {
			const { cell } = proposals[i];
			area += proposals[i].area;
			for (const neighbor of cell.neighbors) {
				const next = neighbor === null ? undefined : byId.get(neighbor);
				if (next === undefined || part[next] !== -1) continue;
				part[next] = start;
				queue.push(next);
			}
		}
		if (area >= minimumArea) areas.set(start, area);
	}
	return { byId, part, areas };
}

type Crossing = Readonly<{ headIds: readonly [string, string]; spanM: number }>;

function crossingEntries(
	crossings: readonly Crossing[],
	byId: ReadonlyMap<string, number>,
	part: Int32Array,
	usable: ReadonlySet<number>
) {
	const entry = new Map<number, { opposite: number; spanM: number }[]>();
	const groups = new Map<number, Set<number>>();
	for (const {
		headIds: [a, b],
		spanM
	} of crossings) {
		const from = required(byId.get(a), 'crossing head');
		const to = required(byId.get(b), 'crossing head');
		if (part[from] === part[to] || !usable.has(part[from]) || !usable.has(part[to])) continue;
		for (const [head, opposite] of [
			[from, to],
			[to, from]
		]) {
			const links = entry.get(head) ?? [];
			links.push({ opposite, spanM });
			entry.set(head, links);
			const adjacent = groups.get(part[head]) ?? new Set<number>();
			adjacent.add(part[opposite]);
			groups.set(part[head], adjacent);
		}
	}
	// Usable parts are already ordered by access, so the first in each component is its source.
	const sources = new Set<number>();
	const seen = new Set<number>();
	for (const region of usable) {
		if (seen.has(region)) continue;
		sources.add(region);
		const queue = [region];
		seen.add(region);
		for (const current of queue) {
			for (const next of groups.get(current) ?? []) {
				if (seen.has(next)) continue;
				seen.add(next);
				queue.push(next);
			}
		}
	}
	return { entry, sources };
}

const { mainPartAreaM2, satelliteEntryM, crossingCostPerMeter } = defaults;

/** Area needed to publish a new region and the maximum number of regions allowed to start. */
export type CityGrowthPolicy = Readonly<{ startupAreaM2: number; maxRegions: number }>;

/** Publication thresholds for the default city. */
export const cityGrowthDefaults: CityGrowthPolicy = Object.freeze({
	startupAreaM2: defaults.startupAreaM2,
	maxRegions: defaults.maxRegions
});

/** Orders growth by access. Every prefix has edge-connected parts with no holes: a new cell
 * must meet each part it touches along an edge, and cannot increase the number of bounded
 * faces in the complement. Dry regions above the minimum area in m² begin at the best
 * access point of their connected component or at a crossing from an occupied region.
 * Crossing access cost increases with span. Small regions incur a cost. The policy limits
 * how many regions can start and the area required to publish a new part. A plan takes
 * prefixes only at complete steps. Deferred proposals retry when a neighboring corner changes. */
export function cityGrowth(
	grid: TerrainGrid,
	cost: (center: Vec2, grade: number) => number,
	minimumPartArea: number,
	crossings: readonly Crossing[] = [],
	{ startupAreaM2, maxRegions } = cityGrowthDefaults
) {
	if (!Number.isFinite(startupAreaM2) || startupAreaM2 < 0)
		throw new RangeError('Expected a finite, nonnegative startup area');
	if (!Number.isSafeInteger(maxRegions) || maxRegions < 0)
		throw new RangeError('Expected a nonnegative integer region limit');
	const proposals = sampleCells(grid, cost);
	const accepted = new Set<number>();
	const { byId, part, areas } = partEntries(proposals, minimumPartArea);
	const priority = (index: number) => {
		const area = required(areas.get(part[index]), 'buildable region area');
		return proposals[index].cost + satelliteEntryM * Math.max(0, 1 - area / mainPartAreaM2);
	};
	const usable = new Set(
		[...areas.keys()].sort((a, b) => priority(a) - priority(b) || a - b).slice(0, maxRegions)
	);
	const { entry, sources } = crossingEntries(crossings, byId, part, usable);
	const published = new Set<number>();
	const nextCost = (index: number) => {
		let cost = Infinity;
		for (const { opposite, spanM } of entry.get(index) ?? []) {
			if (!accepted.has(opposite) || !published.has(part[opposite])) continue;
			cost = Math.min(
				cost,
				Math.max(priority(index), priority(opposite)) + crossingCostPerMeter * spanM
			);
		}
		return cost;
	};
	const byPriority = (a: number, b: number) => priority(a) - priority(b) || a - b;
	const schedule = [...proposals.keys()]
		.filter((index) => usable.has(part[index]))
		.sort(byPriority);
	const started = new Set<number>();
	const tryAdd = admission();
	const waiting = waitingByCorner(proposals);
	const retries = new Set<number>();
	const order: { id: string; builtArea: number; complete: boolean }[] = [];
	const pending = new Map<number, { area: number; indexes: number[] }>();
	let builtArea = 0;

	function append(index: number, complete: boolean) {
		const { cell, area } = proposals[index];
		builtArea += area;
		order.push({ id: cell.id, builtArea, complete });
		for (const { opposite } of entry.get(index) ?? []) retries.add(opposite);
	}

	function publish(index: number) {
		const region = part[index];
		if (published.has(region)) {
			append(index, true);
			return;
		}
		const first = pending.get(region) ?? {
			area: /* Exact arithmetic: a pending region starts with no occupied area. */ 0,
			indexes: []
		};
		first.area += proposals[index].area;
		first.indexes.push(index);
		if (first.area < startupAreaM2) {
			pending.set(region, first);
			return;
		}
		for (const next of first.indexes) append(next, next === index);
		pending.delete(region);
		published.add(region);
	}

	let currentCost = -Infinity;
	const delayed = new Map<number, Set<number>>();
	const later = (index: number, cost: number) => {
		const list = delayed.get(cost) ?? new Set<number>();
		list.add(index);
		delayed.set(cost, list);
	};
	function propose(index: number) {
		if (accepted.has(index) || !usable.has(part[index])) return;
		const { cell } = proposals[index];
		const attached = cell.neighbors.some(
			(id) => id !== null && accepted.has(required(byId.get(id), 'growth neighbor'))
		);
		const first = !started.has(part[index]);
		const source = sources.has(part[index]) && part[index] === index;
		if (!attached && first && !source) {
			const access = nextCost(index);
			if (access > currentCost && Number.isFinite(access)) later(index, access);
			if (access > currentCost) {
				waiting.add(index);
				return;
			}
		}
		if ((!attached && !first) || !tryAdd(cell)) {
			waiting.add(index);
			return;
		}
		accepted.add(index);
		started.add(part[index]);
		waiting.delete(index);
		publish(index);
		waiting.ready(cell, retries);
	}

	function flush() {
		while (retries.size) {
			const batch = [...retries].sort(byPriority);
			retries.clear();
			for (const pending of batch) propose(pending);
		}
	}

	function flushCrossings(before: number) {
		let cost = Math.min(...delayed.keys());
		while (cost <= before && Number.isFinite(cost)) {
			currentCost = cost;
			const batch = required(delayed.get(cost), 'crossing agenda');
			delayed.delete(cost);
			for (const index of batch) retries.add(index);
			flush();
			cost = Math.min(...delayed.keys());
		}
	}

	for (const index of schedule) {
		const cost = priority(index);
		flushCrossings(cost);
		currentCost = cost;
		propose(index);
		flush();
	}
	flushCrossings(Infinity);
	return order;
}
