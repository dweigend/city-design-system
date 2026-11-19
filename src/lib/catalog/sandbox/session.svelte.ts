import { sandboxGenerationYears, type BuildingMethod } from '../data/sandbox';
import type { StrokeRelease } from './feedback';
import { createSessionActions } from './session-actions';
import { focuses, type FocusId } from '../logic/presentation';
import {
	openingScene,
	beginStroke,
	planStroke,
	traceStroke,
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
	const actions = createSessionActions(startingWorld, generationYears, (next) => (state = next));
	let state = $state.raw(actions.snapshot());
	const world = $derived(state.world);
	const completion = $derived(state.completion);
	let roofBuilder = $state.raw<typeof startingWorld.roofBuilder>();
	const projected = $derived(roofBuilder ? { ...world, roofBuilder } : world);
	let stroke = $state.raw<Stroke>();
	const previewPlan = $derived(stroke && planStroke(stroke.base, stroke.tool, stroke.cellIds));
	let tool = $state.raw<Tool>({ kind: 'house', use: 'living' });

	const methods = $derived(stylesForYear(world.state.year));
	let chosenMethod = $state<BuildingMethod>();
	const method = $derived(
		chosenMethod && methods.includes(chosenMethod) ? chosenMethod : methods[0]
	);
	const selectedTool = $derived(tool.kind === 'house' ? { ...tool, style: method } : tool);

	let focus = $state<FocusId>('all');

	return {
		get completion() {
			return completion;
		},
		onCompletion: actions.onCompletion,
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
		advance: actions.advance,
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
				actions.clearRejection();
				chosenMethod = next;
			}
		},
		set tool(next: Tool) {
			actions.clearRejection();
			tool = next;
		},
		get world() {
			return projected;
		},
		get gesture() {
			return stroke;
		},
		get previewPlan() {
			return previewPlan;
		},
		get failure() {
			return stroke ? undefined : state.rejection;
		},
		get canUndo() {
			return state.canUndo;
		},
		get canRedo() {
			return state.canRedo;
		},
		/** Starts a gesture on the snapshot the picker used for the first hit. */
		strokeStart(base: Stroke['base'], cellId: string | undefined) {
			const started = beginStroke(selectedTool, base);
			stroke = cellId ? { ...started, ...traceStroke(base.grid, started, cellId) } : started;
		},
		strokeMove(cellId: string) {
			if (!stroke) return;
			const trace = traceStroke(stroke.base.grid, stroke, cellId);
			if (trace !== stroke) stroke = { ...stroke, ...trace };
		},
		/** Detaches the completed gesture so that its first feedback can paint before the edit. */
		strokeRelease(): StrokeRelease | undefined {
			const release = previewPlan;
			stroke = undefined;
			if (release?.cellIds.length && actions.release(release)) return release;
		},
		commitRelease: actions.commitRelease,
		strokeCancel() {
			stroke = undefined;
		},
		undo: actions.undo,
		redo: actions.redo,
		restart: actions.restart
	};
}

export type Session = ReturnType<typeof createSession>;
