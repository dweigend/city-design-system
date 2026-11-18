/**
 * Geometry of the terrain model: the draped surface, the cut faces of its base and the water.
 * World positions come from the grid; this file only arranges them for the GPU.
 */
import * as THREE from 'three/webgpu';
import type { TerrainGrid } from '../../logic/terrain-grid';
import { pushThree } from '../world-space';

/** Bottom of the model base, meters below mean water. */
const BASE_DEPTH = 9;

/**
 * Terrain surface with one vertex per grid corner and the chart position (column, row) as
 * attribute `chart`. Two triangles per cell in index order: face index >> 1 is the cell index.
 */
export function surfaceGeometry(grid: TerrainGrid): THREE.BufferGeometry {
	const positions: number[] = [];
	const chart: number[] = [];
	const indices: number[] = [];
	const stride = grid.columns + 1;
	grid.vertices.forEach((vertex, i) => {
		pushThree(positions, vertex);
		chart.push(i % stride, Math.floor(i / stride));
	});
	for (let row = 0; row < grid.rows; row++)
		for (let column = 0; column < grid.columns; column++) {
			const a = row * stride + column;
			indices.push(a, a + 1, a + stride + 1, a, a + stride + 1, a + stride);
		}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('chart', new THREE.Float32BufferAttribute(chart, 2));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return geometry;
}

/** Corner points along the grid rim, counter-clockwise, as world points. */
function rim(grid: TerrainGrid) {
	const cell = (column: number, row: number) => grid.cells[row * grid.columns + column];
	const last = { column: grid.columns - 1, row: grid.rows - 1 };
	const points = [];
	for (let c = 0; c <= last.column; c++) points.push(cell(c, 0).corners[0]);
	for (let r = 0; r <= last.row; r++) points.push(cell(last.column, r).corners[1]);
	for (let c = last.column; c >= 0; c--) points.push(cell(c, last.row).corners[2]);
	for (let r = last.row; r >= 0; r--) points.push(cell(0, r).corners[3]);
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
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('chart', new THREE.Float32BufferAttribute(chart, 2));
	geometry.computeVertexNormals();
	return geometry;
}
