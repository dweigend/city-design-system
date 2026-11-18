import type { HouseUse } from '../house-brush';
import type { CoverKind } from '../land-cover';
import { cellsBetween } from '../terrain-grid';
import type { TransitKind } from '../transit-line';
import type { Edit } from './state';
import { applyEdit, type World } from './world';

/** The tool in the player's hand. `look` only moves the view. */
export type Tool =
	| { kind: 'look' }
	| { kind: 'house'; use: HouseUse }
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
}>;

/** Starts a stroke on the given world. */
export const beginStroke = (tool: Tool, world: World): Stroke => ({
	tool,
	base: world,
	draft: world,
	cellIds: []
});

function cellEdit(tool: Tool, cellId: string): Edit | undefined {
	if (tool.kind === 'house') return { kind: 'raise', cellId, use: tool.use };
	if (tool.kind === 'cover') return { kind: 'cover', cellId, cover: tool.cover };
	if (tool.kind === 'dig') return { kind: 'dig', cellId };
	if (tool.kind === 'erase') return { kind: 'clear', cellId };
	return undefined;
}

/**
 * Extends a stroke to a cell. Cells between the last and the new cell are filled in, so a
 * fast pointer leaves no gaps. Every cell reacts once per stroke: one story up, one layer
 * off. A line stroke routes the whole line again from the cells passed so far.
 */
export function extendStroke(stroke: Stroke, cellId: string): Stroke {
	const { grid } = stroke.draft;
	const last = stroke.cellIds[stroke.cellIds.length - 1];
	const reached = last ? cellsBetween(grid, last, cellId).map((cell) => cell.id) : [cellId];
	const fresh = reached.filter((id) => !stroke.cellIds.includes(id));
	if (!fresh.length || !grid.cellsById.has(cellId)) return stroke;
	const cellIds = [...stroke.cellIds, ...fresh];
	if (stroke.tool.kind === 'line') {
		const edit: Edit = { kind: 'line', transit: stroke.tool.transit, cellIds };
		return { ...stroke, cellIds, draft: applyEdit(stroke.base, edit) };
	}
	let draft = stroke.draft;
	for (const id of fresh) {
		const edit = cellEdit(stroke.tool, id);
		if (edit) draft = applyEdit(draft, edit);
	}
	return { ...stroke, cellIds, draft };
}
