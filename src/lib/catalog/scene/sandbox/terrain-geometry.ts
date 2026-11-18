/**
 * Geometry of the terrain model: the draped surface, the cut faces of its base and the water.
 * World positions come from the grid; this file only arranges them for the GPU.
 */
import * as THREE from 'three/webgpu';
import type { TerrainGrid } from '../../logic/terrain-grid';
import { ravineDepth } from '../../logic/terrain';
import { pushThree } from '../world-space';

/** Bottom of the model base, meters below mean water. */
const BASE_DEPTH = 9;

function chartedGeometry(positions: number[], chart: number[]) {
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('chart', new THREE.Float32BufferAttribute(chart, 2));
	return geometry;
}

/**
 * Terrain surface with one vertex per grid corner and the chart position (column, row) as
 * attribute `chart`. Two triangles per cell in index order: face index >> 1 is the cell index.
 */
export function surfaceGeometry(grid: TerrainGrid): THREE.BufferGeometry {
	const positions: number[] = [];
	const chart: number[] = [];
	const indices: number[] = [];
	const relief: number[] = [];
	const frontages: number[] = [];
	for (const cell of grid.cells) {
		const start = positions.length / 3;
		for (const vertex of cell.corners) {
			pushThree(positions, vertex);
			for (let side = 0; side < 4; side++) frontages.push((cell.alleyEdges >> side) & 1);
			relief.push(vertex[2], ravineDepth(grid.terrain, vertex[0], vertex[1]));
		}
		const { column: c, row: r } = cell;
		chart.push(c, r, c + 1, r, c + 1, r + 1, c, r + 1);
		indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
	}
	const geometry = chartedGeometry(positions, chart);
	geometry.setAttribute('frontages', new THREE.Float32BufferAttribute(frontages, 4));
	geometry.setAttribute('relief', new THREE.Float32BufferAttribute(relief, 2));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return geometry;
}

/** Corner points along the grid rim, counter-clockwise, as world points. */
function rim(grid: TerrainGrid) {
	const { columns, rows } = grid;
	const lastRowStart = (rows - 1) * columns;
	const edges = [
		{ start: 0, step: 1, count: columns },
		{ start: columns - 1, step: columns, count: rows },
		{ start: lastRowStart + columns - 1, step: -1, count: columns },
		{ start: lastRowStart, step: -columns, count: rows }
	];
	const points = [];
	for (const [corner, { start, step, count }] of edges.entries()) {
		for (let i = 0; i < count; i++) points.push(grid.cells[start + i * step].corners[corner]);
	}
	return points;
}

/** Vertical cut faces of the model base plus their outline segments. */
export function baseGeometry(grid: TerrainGrid) {
	const positions: number[] = [];
	const lines: number[] = [];
	const points = rim(grid);
	points.forEach((a, i) => {
		const b = points[(i + 1) % points.length];
		const a0: [number, number, number] = [a[0], a[1], -BASE_DEPTH];
		const b0: [number, number, number] = [b[0], b[1], -BASE_DEPTH];
		for (const p of [a0, b0, b, a0, b, a]) pushThree(positions, p);
		for (const p of [a, b, a0, b0]) pushThree(lines, p);
	});
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.computeVertexNormals();
	return { geometry, lines };
}

/** Flat water surface over every cell that reaches below mean water. */
export function waterGeometry(grid: TerrainGrid): THREE.BufferGeometry {
	const positions: number[] = [];
	const chart: number[] = [];
	const level = grid.terrain.waterLevel;
	for (const cell of grid.cells) {
		if (cell.corners.every((corner) => corner[2] > level)) continue;
		const [a, b, c, d] = cell.corners.map((p): [number, number, number] => [p[0], p[1], level]);
		for (const p of [a, b, c, a, c, d]) pushThree(positions, p);
		const { column, row } = cell;
		chart.push(column, row, column + 1, row, column + 1, row + 1);
		chart.push(column, row, column + 1, row + 1, column, row + 1);
	}
	const geometry = chartedGeometry(positions, chart);
	geometry.computeVertexNormals();
	return geometry;
}
