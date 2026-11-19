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
type Trace = Readonly<{
	/** Cells the stroke has passed, in order, each once. */
	cellIds: readonly string[];
	/** Most recent valid pointer cell, if the stroke has reached one. */
	lastPointerCellId: string | undefined;
}>;

export type Stroke = Trace & Readonly<{ tool: Tool; base: World; draft: World; failure?: Failure }>;

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
	const trace = traceStroke(stroke.draft.grid, stroke, cellId);
	if (trace === stroke) return stroke;
	const fresh = trace.cellIds.slice(stroke.cellIds.length);
	if (!fresh.length) return { ...stroke, ...trace };
	const result = evaluateStroke(stroke.base, stroke.tool, trace.cellIds, stroke.draft, fresh);
	return { ...stroke, ...trace, ...result };
}

/** Traces the crossed cells without editing a world. IDs are ordered by first visit. */
export function traceStroke(grid: World['grid'], trace: Trace, cellId: string): Trace {
	const last = trace.lastPointerCellId;
	if (cellId === last || !grid.cellsById.has(cellId)) return trace;
	const reached = last ? cellsBetween(grid, last, cellId).map((cell) => cell.id) : [cellId];
	const visited = new Set(trace.cellIds);
	for (const id of reached) visited.add(id);
	const cellIds = visited.size === trace.cellIds.length ? trace.cellIds : [...visited];
	return { cellIds, lastPointerCellId: cellId };
}

type Outcome = Pick<Stroke, 'draft' | 'failure'>;

function evaluateStroke(
	base: World,
	tool: Tool,
	ids: readonly string[],
	previous: World,
	fresh: readonly string[]
): Outcome {
	const proposal = propose(base, tool, ids);
	if (proposal) {
		if ('failure' in proposal) return { draft: base, failure: proposal.failure };
		return { draft: withState(base, install(base.state, proposal, tool)), failure: undefined };
	}
	if (tool.kind === 'line' && tool.transit !== 'walkway')
		return { draft: applyEdit(base, { kind: 'line', transit: tool.transit, cellIds: ids }) };
	let draft = previous;
	for (const id of fresh) {
		const edit = cellEdit(tool, id);
		if (edit) draft = applyEdit(draft, edit);
	}
	return { draft, failure: undefined };
}

/** Surveys or applies one complete trace to a detached snapshot. Each visited cell is edited once. */
export function applyStroke(world: World, tool: Tool, cellIds: readonly string[]): Outcome {
	const ids = [...new Set(cellIds)];
	if (!ids.length) return { draft: world };
	return evaluateStroke(world, tool, ids, world, ids);
}
