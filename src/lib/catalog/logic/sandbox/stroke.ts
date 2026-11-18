import type { BuildingMethod } from '../../data/sandbox';
import type { HouseUse } from '../house-brush';
import type { CoverKind } from '../land-cover';
import { cellsBetween } from '../terrain-grid';
import type { TransitKind } from '../transit-line';
import type { Edit } from './state';
import { applyEdit, type World } from './world';

/** The tool in the player's hand. `look` only moves the view. */
export type Tool =
	| { kind: 'look' }
	| { kind: 'house'; use: HouseUse; style?: BuildingMethod }
	| { kind: 'line'; transit: TransitKind }
	| { kind: 'cover'; cover: CoverKind }
	| { kind: 'dig' }
	| { kind: 'erase' };

/**
 * One brush stroke in progress: from pointer down to pointer up. `draft` is the world the
 * player sees while drawing; its state becomes one undo step when the stroke ends.
 */
export type Stroke = Readonly<{
	tool: Tool;
	base: World;
	draft: World;
	/** Cells the stroke has passed, in order, each once. */
	cellIds: readonly string[];
	/** Most recent valid pointer cell, if the stroke has reached one. */
	lastPointerCellId: string | undefined;
}>;

/** Creates an empty stroke snapshot for the tool, sharing the given world as base and draft. */
export const beginStroke = (tool: Tool, world: World): Stroke => ({
	tool,
	base: world,
	draft: world,
	cellIds: [],
	lastPointerCellId: undefined
});

function cellEdit(tool: Tool, cellId: string): Edit | undefined {
	if (tool.kind === 'house') return { kind: 'raise', cellId, use: tool.use, style: tool.style };
	if (tool.kind === 'cover') return { kind: 'cover', cellId, cover: tool.cover };
	if (tool.kind === 'dig') return { kind: 'dig', cellId };
	if (tool.kind === 'erase') return { kind: 'clear', cellId };
	return undefined;
}

/**
 * Extends an immutable stroke snapshot to a cell ID on its draft grid, filling from the
 * last pointer cell. Each cell is edited on its first visit, and line strokes route through
 * the cells in first-visit order. A move over visited cells updates the pointer while
 * sharing the draft and visited IDs. A repeated pointer cell or unknown ID returns the
 * input stroke.
 */
export function extendStroke(stroke: Stroke, cellId: string): Stroke {
	const { grid } = stroke.draft;
	const last = stroke.lastPointerCellId;
	if (cellId === last || !grid.cellsById.has(cellId)) return stroke;
	const reached = last ? cellsBetween(grid, last, cellId).map((cell) => cell.id) : [cellId];
	const fresh = reached.filter((id) => !stroke.cellIds.includes(id));
	const lastPointerCellId = cellId;
	if (!fresh.length) return { ...stroke, lastPointerCellId };
	const cellIds = [...stroke.cellIds, ...fresh];
	if (stroke.tool.kind === 'line') {
		const edit: Edit = { kind: 'line', transit: stroke.tool.transit, cellIds };
		return { ...stroke, lastPointerCellId, cellIds, draft: applyEdit(stroke.base, edit) };
	}
	let draft = stroke.draft;
	for (const id of fresh) {
		const edit = cellEdit(stroke.tool, id);
		if (edit) draft = applyEdit(draft, edit);
	}
	return { ...stroke, lastPointerCellId, cellIds, draft };
}
