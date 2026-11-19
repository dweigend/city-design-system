import { propose, install } from './installation';
import type { Failure } from './installation-parts';
import { cellsBetween } from '../terrain-grid';
import type { Edit, Tool } from './state';
import { applyEdit, withState, type World } from './world';

export type { Tool } from './state';
/**
 * One brush stroke in progress: from pointer down to pointer up. `draft` is the world the
 * player sees while drawing; its state becomes one undo step when the stroke ends.
 */
export type Stroke = Readonly<{
	tool: Tool;
	base: World;
	draft: World;
	failure?: Failure;
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
	const fresh = [...new Set(reached)].filter((id) => !stroke.cellIds.includes(id));
	const lastPointerCellId = cellId;
	if (!fresh.length) return { ...stroke, lastPointerCellId };
	const cellIds = [...stroke.cellIds, ...fresh];
	const proposal = propose(stroke.base, stroke.tool, cellIds);
	if (proposal) {
		const result =
			'failure' in proposal
				? { draft: stroke.base, failure: proposal.failure }
				: {
						draft: withState(stroke.base, install(stroke.base.state, proposal, stroke.tool)),
						failure: undefined
					};
		return { ...stroke, cellIds, lastPointerCellId, ...result };
	}
	if (stroke.tool.kind === 'line' && stroke.tool.transit !== 'walkway') {
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
