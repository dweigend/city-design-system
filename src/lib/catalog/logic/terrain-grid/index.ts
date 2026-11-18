import { blockPatches, type BlockCache } from './block-patch';
import { required } from '../required';
import { defaultAlleyPlan, parcelProfile } from './alley-profile';
import { alleyPlan } from './alley-plan';
export { defaultAlleyPlan };
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
	ravineDepth,
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

const latticeOf = (terrain: Terrain, profile = defaultAlleyPlan): Lattice => ({
	terrain,
	profile,
	columns: Math.floor(terrain.along / MODULE),
	rows: Math.floor(terrain.across / MODULE)
});

type Patches = ReturnType<typeof blockPatches>;

function columnVertices(
	lattice: Lattice,
	column: number,
	patches: Patches,
	edits: readonly TerrainEdit[],
	previous?: readonly Vec3[]
): Vec3[] {
	return Array.from({ length: lattice.rows + 1 }, (_, row): Vec3 => {
		const { patch, id, reused } = patches(column, row);
		const old = previous?.[row];
		if (reused && old && !withinEdit(old, edits)) return old;
		const [x, y] = required(patch.positions.get(id), 'relaxed vertex');
		const z = terrainHeight(lattice.terrain, x, y);
		return old && old[0] === x && old[1] === y && old[2] === z ? old : [x, y, z];
	});
}

function withinEdit(point: Vec3, edits: readonly TerrainEdit[]) {
	return edits.some(
		(edit) =>
			(point[0] - edit.center[0]) ** 2 + (point[1] - edit.center[1]) ** 2 <= editReach(edit) ** 2
	);
}

const cachedFields = new WeakMap<TerrainGrid, Map<number, Float64Array>>();
type ShapeColumn = { shift: Float64Array; lean: Float64Array };
const cachedShape = new WeakMap<TerrainGrid, Map<number, ShapeColumn>>();
const cachedBlocks = new WeakMap<TerrainGrid, BlockCache>();

function contourPatches(
	lattice: Lattice,
	from: number,
	to: number,
	cache: BlockCache,
	fields: Map<number, Float64Array>,
	shape: Map<number, ShapeColumn>
) {
	const shifts = rowShifts(lattice, from, to, fields);
	const crossings = new Map<number, Float64Array>();
	const leans = new Map([...shifts.keys()].map((c) => [c, columnLeans(lattice, c, crossings)]));
	const changes = new Map<number, Uint16Array>();
	for (const [c, shift] of shifts) {
		const lean = required(leans.get(c), 'contour lean'),
			old = shape.get(c);
		const count = new Uint16Array(shift.length + 1);
		for (let r = 0; r < shift.length; r++)
			count[r + 1] =
				count[r] + Number(!old || old.shift[r] !== shift[r] || old.lean[r] !== lean[r]);
		changes.set(c, count);
		shape.set(c, { shift, lean });
	}
	const unchanged = (x: number, y: number, width: number, height: number) => {
		for (let c = x; c <= x + width; c++) {
			const count = required(changes.get(c), 'column changes');
			if (count[y] !== count[y + height + 1]) return false;
		}
		return true;
	};
	return blockPatches(
		lattice,
		(c, r) => {
			const [dx, dy] = patternOffsets(
				lattice,
				c,
				r,
				required(leans.get(c), 'contour lean')[r],
				required(shifts.get(c), 'contour shift')[r]
			);
			return valleyPoint(lattice.terrain, c * MODULE + dx, r * MODULE + dy);
		},
		cache,
		unchanged
	);
}

function makeCell(
	lattice: Lattice,
	vertices: readonly (readonly Vec3[])[],
	column: number,
	row: number,
	patches: Patches,
	old?: TerrainCell,
	edits: readonly TerrainEdit[] = []
): TerrainCell {
	const { patch, x, y, id, reused } = patches(column, row);
	if (
		old &&
		reused &&
		!withinEdit(old.center, edits) &&
		old.corners.every((p) => !withinEdit(p, edits))
	)
		return old;
	const face = required(patch.faces.get(id), 'organic parcel');
	const point = (i: number) => {
		const [c, r] = face.vertices[i];
		return vertices[x + c][y + r];
	};
	const corners = [point(0), point(1), point(2), point(3)] as const;
	const vertexId = (i: number) => cellId(x + face.vertices[i][0], y + face.vertices[i][1]);
	const vertexIds = [vertexId(0), vertexId(1), vertexId(2), vertexId(3)] as const;
	const adjacent = (i: number) => {
		const local = face.neighbors[i];
		if (local) return cellId(x + local[0], y + local[1]);
		const [c, r] = [
			[column, row - 1],
			[column + 1, row],
			[column, row + 1],
			[column - 1, row]
		][i];
		return c >= 0 && c < lattice.columns && r >= 0 && r < lattice.rows ? cellId(c, r) : null;
	};
	const source = {
		id: x + ':' + y + '/' + face.block.id,
		sides: face.block.sides,
		mask: face.block.mask
	};
	const neighbors = [adjacent(0), adjacent(1), adjacent(2), adjacent(3)] as const;
	if (old && sameParcel(old, source, corners, neighbors, edits)) return old;
	return describeCell(lattice, corners, column, row, vertexIds, neighbors, source);
}

function sameParcel(
	old: TerrainCell,
	source: { id: string; mask: number },
	corners: TerrainCell['corners'],
	neighbors: TerrainCell['neighbors'],
	edits: readonly TerrainEdit[]
) {
	return (
		old.block === source.id &&
		old.alleyEdges === source.mask &&
		corners.every((p, i) => p === old.corners[i] && neighbors[i] === old.neighbors[i]) &&
		!withinEdit(old.center, edits)
	);
}

function describeCell(
	lattice: Lattice,
	corners: TerrainCell['corners'],
	column: number,
	row: number,
	vertexIds: TerrainCell['vertexIds'],
	neighbors: TerrainCell['neighbors'],
	source: { id: string; sides: number; mask: number }
): TerrainCell {
	const { terrain, columns } = lattice;
	const x = (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4;
	const y = (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4;
	const level = groundLevel(terrain, x, y);
	const zone = terrainZone(terrain, x, y);
	const raised = level < FLOOD_LINE;
	const pattern = patternAt(lattice, column, row);
	const plan = alleyPlan(
		terrain,
		column,
		row,
		{ corners, zone, pattern, incision: ravineDepth(terrain, x, y) },
		lattice.profile
	);
	const alley = plan.direction;
	return {
		id: cellId(column, row),
		pattern,
		plan,
		alley,
		ridgeSide: ((source.mask & 1) !== 0 ? 0 : 1) + ((column + row) % 2),
		block: source.id,
		blockSides: source.sides,
		alleyEdges: source.mask,
		index: row * columns + column,
		column,
		row,
		corners,
		vertexIds,
		center: [x, y, terrainHeight(terrain, x, y)],
		neighbors,
		zone,
		pad: raised ? terrain.waterLevel + FLOOD_DATUM : Math.round(level) + PLINTH,
		raised,
		buildable: !plan.open && !plan.square && (alley === null || plan.edgePassage),
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
	const first = Math.max(0, Math.floor((from - 1) / BLOCK.columns) * BLOCK.columns);
	const end = Math.min(columns, Math.ceil((to + 1) / BLOCK.columns) * BLOCK.columns);
	const last = end - 1;
	// The final seam is fixed and sampled by the block on its right.
	const cache = new Map(previous && cachedBlocks.get(previous));
	const fields = new Map(previous && cachedFields.get(previous));
	for (const edit of edits) {
		const [along] = valleyCoords(lattice.terrain, ...edit.center);
		const reach = editReach(edit) / FRAME_SCALE_MIN;
		for (
			let c = Math.floor((along - reach) / MODULE);
			c <= Math.ceil((along + reach) / MODULE);
			c++
		)
			fields.delete(c);
	}
	const shape = new Map(previous && cachedShape.get(previous));
	const patches = contourPatches(
		lattice,
		first,
		Math.min(columns, end + BLOCK.columns),
		cache,
		fields,
		shape
	);
	for (let c = first; c <= end; c++)
		data.vertices[c] = columnVertices(lattice, c, patches, edits, data.vertices[c]);
	for (let c = first; c <= last; c++)
		data.cells[c] = Array.from({ length: rows }, (_, r) =>
			makeCell(lattice, data.vertices, c, r, patches, data.cells[c]?.[r], edits)
		);
	const result = assemble(lattice.terrain, lattice.profile, data, first, last, previous);
	cachedShape.set(result, shape);
	cachedFields.set(result, fields);
	cachedBlocks.set(result, cache);
	return result;
}

/**
 * Derives the whole grid from a terrain. Deterministic: the same terrain gives the same
 * grid, with row-major arrays materialized on their first bulk read.
 */
export function deriveGrid(
	terrain: Terrain,
	profile?: Parameters<typeof parcelProfile>[0]
): TerrainGrid {
	const lattice = latticeOf(terrain, parcelProfile(profile));
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
	if (terrain.seed !== previous.terrain.seed) return deriveGrid(terrain, previous.profile);
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
	const lattice = latticeOf(terrain, previous.profile);
	let result = previous;
	for (const [from, to] of columnsInReach(lattice, differing))
		result = derive(lattice, from, to, result, differing);
	return result === previous && previous.terrain !== terrain
		? assemble(terrain, previous.profile, columnStorage(previous), 0, -1, previous)
		: result;
}
