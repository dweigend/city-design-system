// Topology and cell quality of one city plan grid.
import { measurePolygon } from '../src/lib/core/geometry';
import { required } from '../src/lib/core/invariant';
import type { TerrainGrid } from '../src/lib/domain/terrain-grid';
import { coarseCellSize, type CityTerrainSampler } from '../src/lib/world/city-site';

export type Point = readonly [number, number];
/** Millimeter key of a coordinate tuple. */
export const key = (p: readonly number[]) => p.map((v) => Math.round(v * 1000)).join(',');

/** Reads a cell ring in plan meters. */
export function polygon(grid: TerrainGrid) {
	const vertices = new Map(grid.vertices.map(({ id, position }) => [id, position]));
	return (vertexIds: readonly string[]): Point[] =>
		vertexIds.map((id) => {
			const [x, y] = required(vertices.get(id), 'plan vertex');
			return [x, y];
		});
}

export function area(points: readonly Point[]) {
	return measurePolygon(points).area;
}

function cellShape(points: readonly Point[]) {
	const n = points.length;
	let minAngle = Math.PI;
	let reflex = 0;
	let shortest = Infinity;
	let diameter = 0;
	for (let i = 0; i < n; i++) {
		const p = points[i];
		const a = points[(i + 1) % n];
		const b = points[(i + n - 1) % n];
		const cross = (a[0] - p[0]) * (b[1] - p[1]) - (a[1] - p[1]) * (b[0] - p[0]);
		const dot = (a[0] - p[0]) * (b[0] - p[0]) + (a[1] - p[1]) * (b[1] - p[1]);
		const angle = Math.atan2(cross, dot);
		if (angle < 0) reflex++;
		minAngle = Math.min(minAngle, Math.abs(angle));
		shortest = Math.min(shortest, Math.hypot(a[0] - p[0], a[1] - p[1]));
		for (const q of points) diameter = Math.max(diameter, Math.hypot(q[0] - p[0], q[1] - p[1]));
	}
	return { minAngle, reflex, shortest, diameter };
}

function components(grid: TerrainGrid) {
	const unseen = new Map(grid.cells.map((cell) => [cell.id, cell]));
	const byCell = new Map<string, number>();
	let parts = 0;
	for (const start of unseen.values()) {
		parts++;
		unseen.delete(start.id);
		const queue = [start];
		for (const { id: current, neighbors } of queue) {
			byCell.set(current, parts);
			for (const id of neighbors) {
				const cell = id === null ? undefined : unseen.get(id);
				if (!cell) continue;
				unseen.delete(cell.id);
				queue.push(cell);
			}
		}
	}
	return { parts, byCell };
}

/** Finds a sampled trunk crossing between two different built parts on nearby banks. */
function spansRiver(grid: TerrainGrid, byCell: Map<string, number>, sample: CityTerrainSampler) {
	const ring = polygon(grid);
	const stations = new Map<number, { point: Point; part: number }[]>();
	for (const { id, vertexIds, neighbors } of grid.cells) {
		if (neighbors.every((neighbor) => neighbor !== null)) continue;
		const point = required(measurePolygon(ring(vertexIds)).centroid, 'plan centroid');
		if (sample(...point).waterClearance > 95) continue;
		const station = Math.floor(point[1] / 100);
		const list = stations.get(station) ?? [];
		list.push({ point, part: required(byCell.get(id), 'plan part') });
		stations.set(station, list);
	}
	for (const bank of stations.values()) {
		for (const {
			point: [x, y],
			part
		} of bank) {
			for (const other of bank) {
				const [u, v] = other.point;
				const dx = u - x;
				if (other.part === part || dx < 10 || dx > 650) continue;
				const count = Math.ceil(Math.hypot(dx, v - y) / 10);
				for (let i = 1; i < count; i++) {
					const kind = sample(x + (i * dx) / count, y + (i * (v - y)) / count).waterKind;
					if (kind === 'river') return true;
				}
			}
		}
	}
	return false;
}

function convexHalf(points: readonly Point[]) {
	const half: Point[] = [];
	for (const point of points) {
		while (half.length >= 2) {
			const [ax, ay] = half[half.length - 2];
			const [bx, by] = half[half.length - 1];
			if ((bx - ax) * (point[1] - ay) - (by - ay) * (point[0] - ax) > 0) break;
			half.pop();
		}
		half.push(point);
	}
	half.pop();
	return half;
}

function shapeMeasures(
	grid: TerrainGrid,
	areas: readonly number[],
	side: (point: Point) => number
) {
	const shape = polygon(grid);
	const points = grid.vertices
		.map(({ position: [x, y] }) => [x, y] as const)
		.sort(([ax, ay], [bx, by]) => ax - bx || ay - by);
	const hull = [...convexHalf(points), ...convexHalf(points.reverse())];
	const total = areas.reduce((sum, value) => sum + value, 0);
	let negative = 0;
	for (const [i, { vertexIds }] of grid.cells.entries()) {
		const center = shape(vertexIds).reduce<Point>(
			([x, y], [a, b]) => [x + a / vertexIds.length, y + b / vertexIds.length],
			[0, 0]
		);
		if (side(center) < 0) negative += areas[i];
	}
	const negativeSideShare = negative / total;
	return {
		negativeSideShare,
		positiveSideShare: 1 - negativeSideShare,
		minorSideShare: Math.min(negativeSideShare, 1 - negativeSideShare),
		compactness: total / area(hull)
	};
}

/** Topology and cell quality of one plan grid. */
export function planMetrics(
	grid: TerrainGrid,
	side: (point: Point) => number = () => 1,
	sample?: CityTerrainSampler
) {
	const shape = polygon(grid);
	const edgeUse = new Map<string, number>();
	for (const { vertexIds } of grid.cells) {
		vertexIds.forEach((a, i) => {
			const b = vertexIds[(i + 1) % vertexIds.length];
			const id = a < b ? `${a}|${b}` : `${b}|${a}`;
			edgeUse.set(id, (edgeUse.get(id) ?? 0) + 1);
		});
	}
	const uses = [...edgeUse.values()];
	const interior = uses.filter((n) => n === 2).length;
	const nonManifold = uses.filter((n) => n > 2).length;
	const { parts, byCell } = components(grid);
	const riverSplit = !!sample && parts > 1 && spansRiver(grid, byCell, sample);
	// Complement components enclosed by the footprint equal C - (V - E + F).
	// An open river or a gap between satellites connects to the exterior.
	const holes = parts - (grid.vertices.length - edgeUse.size + grid.cells.length);
	const positions = new Map<string, number>();
	for (const { position } of grid.vertices) {
		const k = key(position.slice(0, 2));
		positions.set(k, (positions.get(k) ?? 0) + 1);
	}
	const duplicateVertices = [...positions.values()].filter((n) => n > 1).length;
	const areas = grid.cells.map(({ vertexIds }) => area(shape(vertexIds)));
	const median = [...areas].sort((a, b) => a - b)[Math.floor(areas.length / 2)] ?? 0;
	let tiny = 0;
	let aspect = 0;
	let sliver = 0;
	let shortEdge = 0;
	let reflex = 0;
	let degenerate = 0;
	let worstAngle = Math.PI;
	grid.cells.forEach(({ vertexIds }, i) => {
		const s = cellShape(shape(vertexIds));
		const flags = [
			areas[i] < 0.2 * median,
			s.diameter ** 2 / areas[i] > 6,
			s.minAngle < (15 * Math.PI) / 180,
			s.shortest < 0.1 * coarseCellSize
		];
		tiny += +flags[0];
		aspect += +flags[1];
		sliver += +flags[2];
		shortEdge += +flags[3];
		reflex += +(s.reflex > 0);
		degenerate += +flags.some(Boolean);
		worstAngle = Math.min(worstAngle, s.minAngle);
	});
	return {
		cells: grid.cells.length,
		interiorEdges: interior,
		interiorEdgeShare: interior / Math.max(1, interior + nonManifold),
		nonManifold,
		holes,
		parts,
		riverSplit,
		partsWithoutRiverSplit: parts - Number(riverSplit),
		...shapeMeasures(grid, areas, side),
		hanging: hangingVertices(grid),
		duplicateVertices,
		tiny,
		aspect,
		sliver,
		shortEdge,
		concave: reflex,
		degenerate,
		degenerateShare: degenerate / grid.cells.length,
		worstAngleDeg: (worstAngle * 180) / Math.PI
	};
}

/** Vertices that lie inside another cell's edge: T-junctions that break a shared face. */
function hangingVertices(grid: TerrainGrid) {
	const bucket = 40;
	const vertices = new Map(grid.vertices.map(({ id, position }) => [id, position]));
	const index = new Map<string, [string, string][]>();
	for (const { vertexIds } of grid.cells) {
		vertexIds.forEach((a, i) => {
			const b = vertexIds[(i + 1) % vertexIds.length];
			const [ax, ay] = required(vertices.get(a), 'plan vertex');
			const [bx, by] = required(vertices.get(b), 'plan vertex');
			for (
				let x = Math.floor(Math.min(ax, bx) / bucket);
				x <= Math.floor(Math.max(ax, bx) / bucket);
				x++
			)
				for (
					let y = Math.floor(Math.min(ay, by) / bucket);
					y <= Math.floor(Math.max(ay, by) / bucket);
					y++
				) {
					const list = index.get(`${x},${y}`) ?? [];
					list.push([a, b]);
					index.set(`${x},${y}`, list);
				}
		});
	}
	let hanging = 0;
	for (const { id, position } of grid.vertices) {
		const [px, py] = position;
		const near = index.get(`${Math.floor(px / bucket)},${Math.floor(py / bucket)}`) ?? [];
		const found = near.some(([a, b]) => {
			if (a === id || b === id) return false;
			const [ax, ay] = required(vertices.get(a), 'plan vertex');
			const [bx, by] = required(vertices.get(b), 'plan vertex');
			const length = Math.hypot(bx - ax, by - ay);
			const t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / length ** 2;
			if (t <= 1e-6 || t >= 1 - 1e-6) return false;
			return Math.abs((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / length < 1e-3;
		});
		hanging += +found;
	}
	return hanging;
}
