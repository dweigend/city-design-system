/**
 * Area grid derived from the terrain: quad cells of one module (5 m) with terrace, contour, floodplain
 * and civic-square layouts. The grid is a pure function of the
 * terrain — nothing about it is stored. After an intervention only the columns in reach are
 * derived again; cells keep their identities, so everything painted onto them stays in place
 * and adapts to the new cell shapes.
 */
import type { Vec3 } from '../parametrik/types';
import {
	editReach,
	FLOOD_LINE,
	groundLevel,
	terrainHeight,
	terrainZone,
	valleyCoords,
	valleyPoint,
	type Terrain,
	type TerrainEdit
} from '../terrain';
import { BLOCK, columnLeans, MODULE, REACH, rowShifts, type Lattice } from './contour-rows';

import { assemble, columnStorage, CHUNK_CELLS } from './storage';
import { patternAt, patternOffsets } from './patterns';
import { cellId, type TerrainGrid, type TerrainCell } from './types';
export { cellId, type TerrainGrid, type TerrainCell } from './types';
export { cellAtPoint, cellsBetween } from './queries';
export { BLOCK, MODULE } from './contour-rows';
/** Height of a level datum above the ground: the visible foot of every building, meters. */
export const PLINTH = 0.5;
/** Datum of cells that flood, meters above mean water: decks stand on stilts there. */
export const FLOOD_DATUM = 4.5;

/** Smallest radial scale of the valley frame: world meters per frame meter along the valley. */
const FRAME_SCALE_MIN = 0.75;

const latticeOf = (terrain: Terrain): Lattice => ({
	terrain,
	columns: Math.floor(terrain.along / MODULE),
	rows: Math.floor(terrain.across / MODULE)
});

function columnVertices(
	lattice: Lattice,
	column: number,
	shifts: Float64Array,
	leans: Float64Array,
	previous?: readonly Vec3[]
): Vec3[] {
	return Array.from(shifts, (shift, row): Vec3 => {
		const [along, across] = patternOffsets(lattice, column, row, leans[row], shift);
		const [x, y] = valleyPoint(lattice.terrain, column * MODULE + along, row * MODULE + across);
		const old = previous?.[row],
			z = terrainHeight(lattice.terrain, x, y);
		return old && old[0] === x && old[1] === y && old[2] === z ? old : [x, y, z];
	});
}

function streetBand(column: number, row: number): TerrainCell['street'] {
	const across = column % BLOCK.columns === 0;
	if (row % BLOCK.rows === 0) return across ? 'both' : 'along';
	return across ? 'across' : null;
}

function makeCell(
	lattice: Lattice,
	vertices: readonly (readonly Vec3[])[],
	column: number,
	row: number,
	old?: TerrainCell,
	edits: readonly TerrainEdit[] = []
): TerrainCell {
	const vertex = (c: number, r: number) => vertices[c][r];
	const corners = [
		vertex(column, row),
		vertex(column + 1, row),
		vertex(column + 1, row + 1),
		vertex(column, row + 1)
	] as const;
	if (
		old &&
		corners.every((p, i) => p === old.corners[i]) &&
		!edits.some(
			(edit) =>
				Math.hypot(old.center[0] - edit.center[0], old.center[1] - edit.center[1]) <=
				editReach(edit)
		)
	)
		return old;
	return describeCell(lattice, corners, column, row);
}

function describeCell(
	lattice: Lattice,
	corners: TerrainCell['corners'],
	column: number,
	row: number
): TerrainCell {
	const { terrain, columns, rows } = lattice;
	const x = (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4;
	const y = (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4;
	const level = groundLevel(terrain, x, y);
	const zone = terrainZone(terrain, x, y);
	const raised = level < FLOOD_LINE;
	const street = streetBand(column, row);
	const neighbor = (c: number, r: number) =>
		c < 0 || r < 0 || c >= columns || r >= rows ? null : cellId(c, r);
	return {
		id: cellId(column, row),
		pattern: patternAt(lattice, column, row),
		street,
		block: `${Math.floor(column / BLOCK.columns)}:${Math.floor(row / BLOCK.rows)}`,
		index: row * columns + column,
		column,
		row,
		corners,
		vertexIds: [
			cellId(column, row),
			cellId(column + 1, row),
			cellId(column + 1, row + 1),
			cellId(column, row + 1)
		],
		center: [x, y, terrainHeight(terrain, x, y)],
		neighbors: [
			neighbor(column, row - 1),
			neighbor(column + 1, row),
			neighbor(column, row + 1),
			neighbor(column - 1, row)
		],
		zone,
		pad: raised ? terrain.waterLevel + FLOOD_DATUM : Math.round(level) + PLINTH,
		raised,
		buildable: zone !== 'water' && street === null,
		chunk: `${Math.floor(column / CHUNK_CELLS)}:${Math.floor(row / CHUNK_CELLS)}`
	};
}

/** Derives vertex columns `from` … `to` and the cells that touch them; the rest is reused. */
function derive(
	lattice: Lattice,
	from: number,
	to: number,
	previous?: TerrainGrid,
	edits: readonly TerrainEdit[] = []
): TerrainGrid {
	const { columns, rows } = lattice;
	const data = columnStorage(previous);
	const crossings = new Map<number, Float64Array>();
	for (const [column, shifts] of rowShifts(lattice, from, to))
		data.vertices[column] = columnVertices(
			lattice,
			column,
			shifts,
			columnLeans(lattice, column, crossings),
			data.vertices[column]
		);
	const first = Math.max(0, from - 1),
		last = Math.min(columns - 1, to);
	for (let c = first; c <= last; c++)
		data.cells[c] = Array.from({ length: rows }, (_, r) =>
			makeCell(lattice, data.vertices, c, r, data.cells[c]?.[r], edits)
		);
	return assemble(lattice.terrain, data, first, last, previous);
}

/**
 * Derives the whole grid from a terrain. Deterministic: the same terrain gives the same
 * grid, with row-major arrays materialized on their first bulk read.
 */
export function deriveGrid(terrain: Terrain): TerrainGrid {
	const lattice = latticeOf(terrain);
	return derive(lattice, 0, lattice.columns);
}

/** Sorted, disjoint vertex-column intervals affected by inserted, removed or reordered edits. */
function columnsInReach(lattice: Lattice, edits: readonly TerrainEdit[]) {
	const ranges = edits
		.map((edit): [number, number] => {
			const [along] = valleyCoords(lattice.terrain, ...edit.center);
			const reach = editReach(edit) / FRAME_SCALE_MIN;
			return [
				Math.max(0, Math.floor((along - reach) / MODULE) - REACH),
				Math.min(lattice.columns, Math.ceil((along + reach) / MODULE) + REACH)
			];
		})
		.sort(([a], [b]) => a - b);
	const merged: [number, number][] = [];
	for (const [from, to] of ranges) {
		if (from > to) continue;
		const last = merged.at(-1);
		if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to);
		else merged.push([from, to]);
	}
	return merged;
}

/**
 * Derives the grid of a changed terrain from the grid of its predecessor. Only the columns
 * in reach of the interventions that differ are derived again; untouched cells are the same
 * objects as before. The result equals `deriveGrid(terrain)`. A different seed derives all.
 */
export function regrid(previous: TerrainGrid, terrain: Terrain): TerrainGrid {
	if (terrain.seed !== previous.terrain.seed) return deriveGrid(terrain);
	const before = previous.terrain.edits;
	const after = terrain.edits;
	// Preserve edit order and multiplicity: overlapping basin banks blend sequentially.
	let first = 0;
	while (first < before.length && before[first] === after[first]) first++;
	let endBefore = before.length,
		endAfter = after.length;
	while (endBefore > first && endAfter > first && before[endBefore - 1] === after[endAfter - 1]) {
		endBefore--;
		endAfter--;
	}
	const differing = [...before.slice(first, endBefore), ...after.slice(first, endAfter)];
	const lattice = latticeOf(terrain);
	let result = previous;
	for (const [from, to] of columnsInReach(lattice, differing))
		result = derive(lattice, from, to, result, differing);
	return result === previous && previous.terrain !== terrain
		? assemble(terrain, columnStorage(previous), 0, -1, previous)
		: result;
}
