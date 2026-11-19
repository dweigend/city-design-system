import { sandboxGenerationYears, type BuildingMethod } from '../data/sandbox';
import type { Completion } from './feedback';
import { focuses, type FocusId } from '../logic/presentation';
import {
	applyEdit,
	applyStroke,
	commit,
	openingScene,
	traceStroke,
	redo,
	startHistory,
	undo,
	withState,
	type Stroke,
	type Tool,
	stylesForYear,
	timelineWindow
} from '../logic/sandbox';

/**
 * Reactive session of one sandbox: the world, the tool, the stroke in progress and the undo
 * history. View state for the components; every change of the world goes through the actions
 * of logic/sandbox.
 */
export function createSession(initialSeed: number, generationYears = sandboxGenerationYears) {
	const { world: startingWorld, additions } = openingScene(initialSeed);
	/** The committed world; its derived grid is the session's cache (PT-14). */
	let world = $state.raw(startingWorld);
	let roofBuilder = $state.raw<typeof world.roofBuilder>();
	const projected = $derived.by(() => {
		const current = world;
		return roofBuilder ? { ...current, roofBuilder } : current;
	});
	let history = $state.raw(startHistory(startingWorld.state));
	let stroke = $state.raw<Pick<Stroke, 'cellIds' | 'lastPointerCellId'>>();
	let strokeTool: Tool | undefined;
	let completion = $state.raw<Completion>();
	let tool = $state.raw<Tool>({ kind: 'house', use: 'living' });

	const methods = $derived(stylesForYear(world.state.year));
	let chosenMethod = $state<BuildingMethod>();
	const method = $derived(
		chosenMethod && methods.includes(chosenMethod) ? chosenMethod : methods[0]
	);
	const selectedTool = $derived(tool.kind === 'house' ? { ...tool, style: method } : tool);

	let rejection = $state.raw<Stroke['failure']>();
	let focus = $state<FocusId>('all');
	function restore(next: typeof history) {
		rejection = undefined;
		completion = undefined;
		history = next;
		world = withState(world, next.present);
	}

	function edit(next: typeof world, kind: Completion['kind'], cellIds: readonly string[] = []) {
		if (next === world) return;
		completion = { kind, before: world, after: next, cellIds };
		world = next;
		history = commit(history, world.state);
	}

	return {
		get completion() {
			return completion;
		},
		opening: { additions, additionSeed: initialSeed },
		get timelineWindow() {
			return timelineWindow(startingWorld.state.year, world.state.year, generationYears);
		},
		setRoofBuilder(value: NonNullable<typeof roofBuilder>) {
			roofBuilder = value;
		},
		get focus() {
			return focus;
		},
		cycleFocus() {
			const keys = Object.keys(focuses) as FocusId[];
			focus = keys[(keys.indexOf(focus) + 1) % keys.length];
		},
		advance() {
			if (stroke) return;
			rejection = undefined;
			edit(applyEdit(world, { kind: 'advance', years: generationYears }), 'advance');
		},
		get tool() {
			return selectedTool;
		},
		get methods() {
			return methods;
		},
		get method() {
			return method;
		},
		/** Changes the house method if it is available in this epoch. */
		pickMethod(next: BuildingMethod) {
			if (tool.kind === 'house' && methods.includes(next)) {
				rejection = undefined;
				chosenMethod = next;
			}
		},
		set tool(next: Tool) {
			rejection = undefined;
			tool = next;
		},
		get world() {
			return projected;
		},
		get previewCells() {
			return stroke?.cellIds ?? [];
		},
		get failure() {
			return stroke ? stroke.failure : rejection;
		},
		get canUndo() {
			return history.past.length > 0;
		},
		get canRedo() {
			return history.future.length > 0;
		},
		strokeStart(cellId: string | undefined) {
			strokeTool = selectedTool;
			stroke = { cellIds: [], lastPointerCellId: undefined };
			if (cellId) stroke = traceStroke(world.grid, stroke, cellId);
		},
		strokeMove(cellId: string) {
			if (stroke) stroke = traceStroke(world.grid, stroke, cellId);
		},
		strokeEnd() {
			if (stroke && strokeTool) {
				const result = applyStroke(world, strokeTool, stroke.cellIds);
				rejection = result.failure;
				edit(result.draft, strokeTool.kind, stroke.cellIds);
			}
			stroke = undefined;
			strokeTool = undefined;
		},
		strokeCancel() {
			stroke = undefined;
			strokeTool = undefined;
		},
		undo: () => restore(undo(history)),
		redo: () => restore(redo(history)),
		/** New terrain from a seed; the built city starts with its seeded town. */
		restart(seed: number) {
			stroke = undefined;
			rejection = undefined;
			strokeTool = undefined;
			completion = undefined;
			world = openingScene(seed).world;
			history = startHistory(world.state);
		}
	};
}

export type Session = ReturnType<typeof createSession>;
