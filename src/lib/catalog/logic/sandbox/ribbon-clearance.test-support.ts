import { intersect, shoelaceArea } from '../parametrik/raster/geometry';
import type { Point2 } from '../ansicht/geometrie';
import { crossProduct, type Primitive, type Vec3 } from '../parametrik/types';
import { cellAtPoint, type TerrainCell, type TerrainGrid } from '../terrain-grid';
import { required } from '../required';

const xy = ([x, y]: Vec3): Point2 => [x, y];

function elevation([a, b, c]: Vec3[]) {
	const [nx, ny, nz] = crossProduct(
		[b[0] - a[0], b[1] - a[1], b[2] - a[2]],
		[c[0] - a[0], c[1] - a[1], c[2] - a[2]]
	);
	return ([x, y]: Point2) => a[2] - (nx * (x - a[0]) + ny * (y - a[1])) / nz;
}

function soilFaces(cell: TerrainCell) {
	const bank = cell.bank;
	if (!bank) {
		const [a, b, c, d] = cell.corners;
		return [
			[a, b, c],
			[a, c, d]
		];
	}
	const faces: Vec3[][] = [];
	for (let row = 0; row < bank.divisions; row++)
		for (let col = 0; col < bank.divisions; col++) {
			const k = row * (bank.divisions + 1) + col;
			const a = bank.points[k],
				b = bank.points[k + 1],
				d = bank.points[k + bank.divisions + 1],
				c = bank.points[k + bank.divisions + 2];
			faces.push([a, b, c], [a, c, d]);
		}
	return faces;
}

function overlapCells(grid: TerrainGrid, triangle: Point2[]) {
	const centre = triangle.reduce(([x, y], [u, v]) => [x + u / 3, y + v / 3], [0, 0]);
	const pending = new Set([required(cellAtPoint(grid, centre[0], centre[1]), 'ribbon parcel')]);
	const cells: TerrainCell[] = [];
	for (const cell of pending) {
		if (!intersect(triangle, cell.corners.map(xy)).length) continue;
		cells.push(cell);
		for (const id of cell.neighbors) {
			const next = id && grid.cellsById.get(id);
			if (next) pending.add(next);
		}
	}
	return cells;
}

type Gaps = { ground: number; water: number };
function measureFace(gaps: Gaps, face: Vec3[], grid: TerrainGrid) {
	const triangle = face.map(xy);
	const top = elevation(face);
	for (const cell of overlapCells(grid, triangle)) {
		const water = cell.bank?.water ?? (cell.zone === 'water' ? grid.terrain.waterLevel : undefined);
		for (const ground of soilFaces(cell)) {
			const overlap = intersect(triangle, ground.map(xy));
			if (Math.abs(shoelaceArea(overlap)) < 1e-12) continue;
			const soil = elevation(ground);
			for (const p of overlap) gaps.ground = Math.min(gaps.ground, top(p) - soil(p));
			if (water !== undefined)
				gaps.water = Math.min(gaps.water, waterClearance(overlap, soil, top, water));
		}
	}
}

/** Measures both wearing triangles against every overlapping finished terrain triangle.
 * The clearance between two planes reaches its minimum at an overlap vertex. */
export function ribbonClearance(mesh: Extract<Primitive, { kind: 'mesh' }>, grid: TerrainGrid) {
	const gaps = { ground: Infinity, water: Infinity };
	for (let i = 0; i < mesh.triangles.length; i += 3) {
		const indices = mesh.triangles.slice(i, i + 3);
		if (indices.every((j) => j % 4 >= 2))
			measureFace(
				gaps,
				indices.map((j) => mesh.points[j]),
				grid
			);
	}
	return gaps;
}

function waterClearance(
	ring: Point2[],
	soil: (p: Point2) => number,
	top: (p: Point2) => number,
	water: number
) {
	let gap = Infinity;
	for (const [i, a] of ring.entries()) {
		const b = ring[(i + 1) % ring.length],
			da = soil(a) - water,
			db = soil(b) - water;
		if (da < 0) gap = Math.min(gap, top(a) - water);
		if (da * db < 0) {
			const t = da / (da - db);
			gap = Math.min(gap, top([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]) - water);
		}
	}
	return gap;
}
