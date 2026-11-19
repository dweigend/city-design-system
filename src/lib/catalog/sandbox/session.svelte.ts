import { sandboxGenerationYears, type BuildingMethod } from '../data/sandbox';
import type { StrokeRelease } from './feedback';
import { createSessionActions } from './session-actions';
import { focuses, type FocusId } from '../logic/presentation';
import {
	openingScene,
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
	const { world: startingWorld, additions, referenceCellId } = openingScene(initialSeed);
	const actions = createSessionActions(startingWorld, generationYears, (next) => (state = next));
	let state = $state.raw(actions.snapshot());
	const world = $derived(state.world);
	const completion = $derived(state.completion);
	let roofBuilder = $state.raw<typeof startingWorld.roofBuilder>();
	const projected = $derived(roofBuilder ? { ...world, roofBuilder } : world);
	let stroke = $state.raw<Pick<Stroke, 'cellIds' | 'lastPointerCellId'>>();
	let strokeTool: Tool | undefined;
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
		opening: { additions, additionSeed: initialSeed, referenceCellId },
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
			if (!stroke) actions.advance();
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
		get previewCells() {
			return stroke?.cellIds ?? [];
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
		strokeStart(cellId: string | undefined) {
			strokeTool = selectedTool;
			stroke = { cellIds: [], lastPointerCellId: undefined };
			if (cellId) stroke = traceStroke(world.grid, stroke, cellId);
		},
		strokeMove(cellId: string) {
			if (stroke) stroke = traceStroke(world.grid, stroke, cellId);
		},
		/** Detaches the completed gesture so that its first feedback can paint before the edit. */
		strokeRelease(): StrokeRelease | undefined {
			const release =
				stroke?.cellIds.length && strokeTool
					? { tool: strokeTool, cellIds: stroke.cellIds }
					: undefined;
			stroke = undefined;
			strokeTool = undefined;
			if (release) actions.release(release);
			return release;
		},
		commitRelease: actions.commitRelease,
		strokeCancel() {
			stroke = undefined;
			strokeTool = undefined;
		},
		undo: actions.undo,
		redo: actions.redo,
		/** New terrain from a seed; the built city starts with its seeded town. */
		restart(seed: number) {
			stroke = undefined;
			strokeTool = undefined;
			actions.restart(seed);
		}
	};
}

export type Session = ReturnType<typeof createSession>;
