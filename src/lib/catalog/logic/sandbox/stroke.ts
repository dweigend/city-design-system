import { frameIntent } from './frame-intent';
import { styleForYear, stylesForYear } from './state';
import { propose, install } from './installation';
import { MAX_STORIES, storiesOf } from '../house-brush';
import { rejected, type Failure, type Proposal } from './installation-parts';
import { cellsBetween } from '../terrain-grid';
import type { Edit, Tool } from './state';
import { applyEdit, digStroke, eraseStroke, withState, type World } from './world';

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
	const proposal = propose(stroke.base, stroke.tool, trace.cellIds);
	const result = evaluateStroke(
		stroke.base,
		stroke.tool,
		trace.cellIds,
		proposal,
		stroke.draft,
		fresh
	);
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
	proposal: Proposal | undefined,
	previous: World,
	fresh: readonly string[]
): Outcome {
	if (isFrameStroke(base, tool)) return frameIntent(base, ids);
	if (proposal) {
		if ('failure' in proposal) return { draft: base, failure: proposal.failure };
		return { draft: withState(base, install(base.state, proposal, tool)), failure: undefined };
	}
	if (tool.kind === 'line' && tool.transit !== 'walkway')
		return { draft: applyEdit(base, { kind: 'line', transit: tool.transit, cellIds: ids }) };
	if (tool.kind === 'dig') return { draft: digStroke(base, ids) };
	if (tool.kind === 'erase') return { draft: eraseStroke(base, ids) };
	return applyCells(base, previous, tool, ids, fresh);
}

/** Surveys a trace once and retains the same proposal for drawing and applying it. */
export function planStroke(base: World, tool: Tool, cellIds: readonly string[]) {
	const ids: readonly string[] = [...new Set(cellIds)];
	const proposal = ids.length ? propose(base, tool, ids) : undefined;
	let result: Outcome | undefined;
	return {
		base,
		tool,
		cellIds: ids,
		proposal,
		outcome(): Outcome {
			return (result ??= ids.length
				? evaluateStroke(base, tool, ids, proposal, base, ids)
				: { draft: base });
		}
	} as const;
}

export type StrokePlan = ReturnType<typeof planStroke>;

/** Surveys or applies one complete trace to a detached snapshot. Each visited cell is edited once. */
export function applyStroke(world: World, tool: Tool, cellIds: readonly string[]): Outcome {
	return planStroke(world, tool, cellIds).outcome();
}

function heightLimit(world: World, tool: Extract<Tool, { kind: 'house' }>, ids: readonly string[]) {
	const style = tool.style === 'collage' ? 'composed' : tool.style;
	if (style && !stylesForYear(world.state.year).includes(style)) return;
	const capped = ids.flatMap((id) => {
		const cell = world.grid.cellsById.get(id);
		return cell?.buildable && storiesOf(world.state.stacks, id).length >= MAX_STORIES ? [cell] : [];
	});
	return capped.length ? rejected('story-limit', capped).failure : undefined;
}

function applyCells(
	base: World,
	previous: World,
	tool: Tool,
	ids: readonly string[],
	fresh: readonly string[]
): Outcome {
	let draft = previous;
	for (const id of fresh) {
		const edit = cellEdit(tool, id);
		if (edit) draft = applyEdit(draft, edit);
	}
	const failure =
		draft === base && tool.kind === 'house' ? heightLimit(base, tool, ids) : undefined;
	return { draft, failure };
}

function isFrameStroke(base: World, tool: Tool) {
	return (
		tool.kind === 'house' &&
		(tool.style ?? styleForYear(base.state.year)) === 'megastructure' &&
		stylesForYear(base.state.year).includes('megastructure')
	);
}
