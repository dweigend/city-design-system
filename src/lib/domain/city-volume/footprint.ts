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

/** Orders growth by access. Every prefix has edge-connected parts with no holes: a new cell
 * must meet each part it touches along an edge, and cannot increase the number of bounded
 * faces in the complement. Deferred proposals retry when a neighboring corner changes. */
export function cityGrowth(grid: TerrainGrid, cost: (center: Vec2, grade: number) => number) {
	const proposals = sampleCells(grid, cost);
	const accepted = new Set<number>();
	const tryAdd = admission();
	const waiting = waitingByCorner(proposals);
	const retries = new Set<number>();
	const order: { id: string; builtArea: number }[] = [];
	let builtArea = 0;

	function propose(index: number) {
		if (accepted.has(index)) return;
		const { cell, area } = proposals[index];
		if (!tryAdd(cell)) {
			waiting.add(index);
			return;
		}
		accepted.add(index);
		waiting.delete(index);
		builtArea += area;
		order.push({ id: cell.id, builtArea });
		waiting.ready(cell, retries);
	}

	for (const index of proposals.keys()) {
		propose(index);
		while (retries.size) {
			const batch = [...retries].sort((a, b) => a - b);
			retries.clear();
			for (const pending of batch) propose(pending);
		}
	}
	return order;
}
