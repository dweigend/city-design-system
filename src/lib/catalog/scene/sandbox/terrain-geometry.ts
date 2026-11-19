/**
 * Geometry of the terrain model: the draped surface, the cut faces of its base and the water.
 * World positions come from the grid; this file only arranges them for the GPU.
 */
import * as THREE from 'three/webgpu';
import type { TerrainCell, TerrainGrid } from '../../logic/terrain-grid';
import { changedChunks } from '../../logic/quad-grid';
import { bankDistance, ravineDepth, valleyCoords } from '../../logic/terrain';
import { pushThree } from '../world-space';

/** Bottom of the model base, meters below mean water. */
const BASE_DEPTH = 9;

function chartedGeometry(positions: number[], chart: number[]) {
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('chart', new THREE.Float32BufferAttribute(chart, 2));
	return geometry;
}

function surfaceAttributes(count: number) {
	return {
		position: new THREE.BufferAttribute(new Float32Array(count * 3), 3),
		shore: new THREE.BufferAttribute(new Float32Array(count), 1),
		frontages: new THREE.BufferAttribute(new Float32Array(count * 4), 4),
		relief: new THREE.BufferAttribute(new Float32Array(count * 2), 2)
	};
}

function writeSurface(
	attributes: Record<
		keyof ReturnType<typeof surfaceAttributes>,
		THREE.BufferAttribute | THREE.InterleavedBufferAttribute
	>,
	grid: TerrainGrid,
	cell: TerrainCell
) {
	const { position, shore, relief, frontages } = attributes;
	for (const [i, [x, y, z]] of cell.corners.entries()) {
		const at = cell.index * 4 + i;
		position.setXYZ(at, x, z, -y);
		shore.setX(at, bankDistance(grid.terrain, x, y) - grid.profile.bankSetback);
		relief.setXY(at, z, ravineDepth(grid.terrain, x, y));
	}
	const first = cell.index * 4;
	const edge = (index: number) => (cell.alleyEdges >> index) & 1;
	for (let i = 0; i < 4; i++) frontages.setXYZW(first + i, edge(0), edge(1), edge(2), edge(3));
}

/**
 * Terrain surface with a vertex copy for each cell corner and its chart position.
 * Two triangles per cell in index order: face index >> 1 is the cell index.
 */
export function surfaceGeometry(grid: TerrainGrid): THREE.BufferGeometry {
	const attributes = surfaceAttributes(grid.cells.length * 4);
	const chart: number[] = [];
	const indices: number[] = [];
	for (const cell of grid.cells) {
		writeSurface(attributes, grid, cell);
		const start = cell.index * 4;
		const { column: c, row: r } = cell;
		chart.push(c, r, c + 1, r, c + 1, r + 1, c, r + 1);
		indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
	}
	const geometry = new THREE.BufferGeometry();
	for (const [name, attribute] of Object.entries(attributes))
		geometry.setAttribute(name, attribute);
	geometry.setAttribute('chart', new THREE.Float32BufferAttribute(chart, 2));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return geometry;
}

/** Rewrites terrain vertices from the changed cells of a regrid with the same lattice. */
export function patchSurface(
	geometry: THREE.BufferGeometry,
	previous: TerrainGrid,
	grid: TerrainGrid
) {
	// The surface owns these non-interleaved BufferAttributes, installed by surfaceGeometry.
	const attributes = {
		position: geometry.attributes.position,
		shore: geometry.attributes.shore,
		frontages: geometry.attributes.frontages,
		relief: geometry.attributes.relief
	};
	for (const key of changedChunks(previous, grid)) {
		for (const cell of grid.chunks.get(key) ?? []) {
			if (cell !== previous.cellsById.get(cell.id)) writeSurface(attributes, grid, cell);
		}
	}
	for (const attribute of Object.values(attributes)) attribute.needsUpdate = true;
	geometry.boundingSphere = null;
	geometry.boundingBox = null;
	geometry.computeVertexNormals();
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
export function waterGeometry(
	grid: TerrainGrid,
	piers: readonly (readonly number[])[] = []
): THREE.BufferGeometry {
	const positions: number[] = [],
		chart: number[] = [],
		wake: number[] = [];
	const terrain = grid.terrain,
		level = terrain.waterLevel;
	const riverChart = (x: number, y: number) => [
		valleyCoords(terrain, x, y)[0],
		bankDistance(terrain, x, y)
	];
	const sources = piers.map((p) => riverChart(p[0], p[1]));
	const smooth = THREE.MathUtils.smoothstep;
	function wakeAt(along: number, across: number) {
		let bend = 0;
		for (const [station, bank] of sources) {
			const dx = along - station,
				dy = across - bank;
			if (dx <= 0 || dx >= 15 || Math.abs(dy) >= 6) continue;
			bend +=
				smooth(dx, 0, 2) *
				(1 - smooth(dx, 2, 15)) *
				Math.sin(dy * 0.64) *
				(1 - smooth(Math.abs(dy), 1, 6));
		}
		return bend;
	}
	for (const cell of grid.cells) {
		if (cell.corners.every((corner) => corner[2] > level)) continue;
		for (const i of [0, 1, 2, 0, 2, 3]) {
			const [x, y] = cell.corners[i],
				[along, across] = riverChart(x, y);
			pushThree(positions, [x, y, level]);
			chart.push(along, across);
			wake.push(wakeAt(along, across));
		}
	}
	const geometry = chartedGeometry(positions, chart);
	geometry.setAttribute('wake', new THREE.Float32BufferAttribute(wake, 1));
	geometry.setAttribute(
		'riverWidth',
		new THREE.Float32BufferAttribute(
			new Float32Array(wake.length).fill(terrain.bands.riverEnd - terrain.bands.riverStart),
			1
		)
	);
	geometry.computeVertexNormals();
	return geometry;
}
