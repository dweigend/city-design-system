import { quadGrid, type QuadGrid, type QuadCell } from '../quad-grid';
import { passageClearance, type TerrainGrid, type TerrainCell } from '../terrain-grid';

const carriers = new WeakMap<TerrainGrid, QuadGrid>();
type Cut = { id: string; point: QuadCell['corners'][number] };

/** Cut points on the same directed parcel side may differ by a millimetre per metre of passage width. */
function frontageVertices() {
	const cuts = new Map<string, (Cut & { owner: TerrainCell })[]>();
	const vertex = (cell: TerrainCell, i: number): Cut => {
		const point = (cell.lotCorners ?? cell.corners)[i];
		const id = cell.vertexIds[i];
		const front = cell.alleyEdges & 1 ? 0 : 2;
		if (!cell.lotCorners || (i !== front && i !== (front + 1) % 4)) return { id, point };
		const back = cell.vertexIds[(i + (i === front ? 3 : 1)) % 4];
		const key = id + '>' + back;
		const list = cuts.get(key) ?? [];
		const candidate = list.find(
			(v) =>
				Math.hypot(v.point[0] - point[0], v.point[1] - point[1], v.point[2] - point[2]) <=
				cell.plan.width / 1000
		);
		if (candidate) {
			if (passageClearance(cell.corners, cell.alleyEdges, candidate.point) >= cell.plan.width)
				return candidate;
			const { owner } = candidate;
			if (passageClearance(owner.corners, owner.alleyEdges, point) >= owner.plan.width) {
				candidate.point = point;
				return candidate;
			}
		}
		const cut = { id: key + ':' + cell.id, point, owner: cell };
		list.push(cut);
		cuts.set(key, list);
		return cut;
	};
	return vertex;
}

function plotCells(grid: TerrainGrid) {
	const vertex = frontageVertices();
	// Resolve both owners before materializing either immutable footprint.
	const cuts = grid.cells.map((cell) =>
		cell.lotCorners ? [0, 1, 2, 3].map((i) => vertex(cell, i)) : undefined
	);
	return grid.cells.map((cell): QuadCell => {
		const row = cuts[cell.index];
		if (!row) return cell;
		const [a, b, c, d] = row;
		const corners = [a.point, b.point, c.point, d.point] as const;
		const mean = (i: number) => corners.reduce((sum, p) => sum + p[i], 0) / 4;
		return {
			...cell,
			corners,
			vertexIds: [a.id, b.id, c.id, d.id],
			center: [mean(0), mean(1), mean(2)]
		};
	});
}

/** Building footprints exclude the public passage. Only uninterrupted sides can join a mass. */
export function buildingPlots(grid: TerrainGrid) {
	const cached = carriers.get(grid);
	if (cached) return cached;
	const plots = plotCells(grid);
	const cells = plots.map((cell): QuadCell => {
		const joinedSide = (id: string | null, i: number) => {
			const next = id && grid.cellsById.get(id);
			if (!next) return null;
			const b = plots[next.index],
				j = b.neighbors.indexOf(cell.id);
			return j >= 0 &&
				cell.vertexIds[i] === b.vertexIds[(j + 1) % 4] &&
				cell.vertexIds[(i + 1) % 4] === b.vertexIds[j]
				? id
				: null;
		};
		const [a, b, c, d] = cell.neighbors.map(joinedSide);
		return { ...cell, neighbors: [a, b, c, d] };
	});
	const carrier = quadGrid(cells);
	carriers.set(grid, carrier);
	return carrier;
}
