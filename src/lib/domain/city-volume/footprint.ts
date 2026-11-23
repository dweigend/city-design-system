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
	const part = new Int32Array(proposals.length).fill(-1);
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

const minimumStartAreaM2 = 10_800;
const maximumParts = 8;
const mainPartAreaM2 = 1_000_000;
const satelliteEntryM = 180;

/** Orders growth by access. Every prefix has edge-connected parts with no holes: a new cell
 * must meet each part it touches along an edge, and cannot increase the number of bounded
 * faces in the complement. Each dry region above the minimum area in m² starts once
 * at its best access point. Small regions incur an access cost and at most eight start.
 * A new part enters the published order as a group of at least 10,800 m². A plan takes
 * prefixes only at complete steps. Deferred proposals retry when a neighboring corner changes. */
export function cityGrowth(
	grid: TerrainGrid,
	cost: (center: Vec2, grade: number) => number,
	minimumPartArea: number
) {
	const proposals = sampleCells(grid, cost);
	const accepted = new Set<number>();
	const { byId, part, areas } = partEntries(proposals, minimumPartArea);
	const priority = (index: number) => {
		const area = required(areas.get(part[index]), 'buildable region area');
		return proposals[index].cost + satelliteEntryM * Math.max(0, 1 - area / mainPartAreaM2);
	};
	const byPriority = (a: number, b: number) => priority(a) - priority(b) || a - b;
	const usable = new Set([...areas.keys()].sort(byPriority).slice(0, maximumParts));
	const schedule = [...proposals.keys()]
		.filter((index) => usable.has(part[index]))
		.sort(byPriority);
	const started = new Set<number>();
	const tryAdd = admission();
	const waiting = waitingByCorner(proposals);
	const retries = new Set<number>();
	const order: { id: string; builtArea: number; complete: boolean }[] = [];
	const pending = new Map<number, { area: number; indexes: number[] }>();
	const published = new Set<number>();
	let builtArea = 0;

	function publish(index: number) {
		const region = part[index];
		const { cell, area } = proposals[index];
		if (published.has(region)) {
			builtArea += area;
			order.push({ id: cell.id, builtArea, complete: true });
			return;
		}
		const first = pending.get(region) ?? { area: 0, indexes: [] };
		first.area += area;
		first.indexes.push(index);
		if (first.area < minimumStartAreaM2) {
			pending.set(region, first);
			return;
		}
		for (const next of first.indexes) {
			builtArea += proposals[next].area;
			order.push({ id: proposals[next].cell.id, builtArea, complete: next === index });
		}
		pending.delete(region);
		published.add(region);
	}

	function propose(index: number) {
		if (accepted.has(index) || !usable.has(part[index])) return;
		const { cell } = proposals[index];
		const attached = cell.neighbors.some(
			(id) => id !== null && accepted.has(required(byId.get(id), 'growth neighbor'))
		);
		if ((!attached && (started.has(part[index]) || part[index] !== index)) || !tryAdd(cell)) {
			waiting.add(index);
			return;
		}
		accepted.add(index);
		started.add(part[index]);
		waiting.delete(index);
		publish(index);
		waiting.ready(cell, retries);
	}

	for (const index of schedule) {
		propose(index);
		while (retries.size) {
			const batch = [...retries].sort(byPriority);
			retries.clear();
			for (const pending of batch) propose(pending);
		}
	}
	return order;
}
