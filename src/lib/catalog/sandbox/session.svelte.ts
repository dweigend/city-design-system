import { sandboxGenerationYears, type BuildingMethod } from '../data/sandbox';
import type { StrokeRelease } from './feedback';
import { createSessionActions } from './session-actions';
import { createSerialInput } from './serial-input';
import { focuses, type FocusId } from '../logic/presentation';
import {
	openingScene,
	planStroke,
	traceStroke,
	type Stroke,
	type StrokePlan,
	type Tool,
	stylesForYear,
	timelineWindow
} from '../logic/sandbox';

/**
 * Reactive session of one sandbox: the world, the tool, the stroke in progress and the undo
 * history. View state for the components; every change of the world goes through the actions
 * of logic/sandbox.
 */
export function createSession(
	initialSeed: number,
	generationYears = sandboxGenerationYears,
	open = openingScene
) {
	const { world: startingWorld, additions } = open(initialSeed);
	const actions = createSessionActions(
		startingWorld,
		generationYears,
		(next) => (state = next),
		(seed) => open(seed).world
	);
	const input = createSerialInput((error) => {
		stroke = pending = surveyed = undefined;
		console.error('Sandbox stroke failed', error);
		actions.reject('stroke-failed');
	});
	let state = $state.raw(actions.snapshot());
	const world = $derived(state.world);
	const completion = $derived(state.completion);
	let roofBuilder = $state.raw<typeof startingWorld.roofBuilder>();
	const projected = $derived(roofBuilder ? { ...world, roofBuilder } : world);
	let stroke = $state.raw<Pick<Stroke, 'cellIds' | 'lastPointerCellId'>>();
	let pending = $state.raw<StrokeRelease>();
	let surveyed: StrokePlan | undefined;
	let tool = $state.raw<Tool>({ kind: 'house', use: 'living' });

	const methods = $derived(stylesForYear(world.state.year));
	let chosenMethod = $state<BuildingMethod>();
	const method = $derived(
		chosenMethod && methods.includes(chosenMethod) ? chosenMethod : methods[0]
	);
	const selectedTool = $derived(tool.kind === 'house' ? { ...tool, style: method } : tool);

	let focus = $state<FocusId>('all');

	/** Resolves options at replay time, after any preceding tool choices. */
	function selectTool(choose: () => Tool) {
		input.control(() => (tool = choose()));
	}

	/** Shares one survey between the final preview and its commit. */
	function surveyRelease(release: StrokeRelease) {
		if (pending !== release) return;
		return (surveyed ??= planStroke(world, selectedTool, release.cellIds));
	}

	function settleRelease(
		release: StrokeRelease,
		work: (plan: StrokePlan | undefined) => void,
		beforeReplay?: () => void
	) {
		if (pending !== release) return;
		const plan = surveyed;
		pending = surveyed = undefined;
		input.finish(() => {
			try {
				work(plan);
			} finally {
				beforeReplay?.();
			}
		});
	}

	return {
		input: input.pointer,
		control: input.control,
		get completion() {
			return completion;
		},
		onCompletion: actions.onCompletion,
		opening: { additions, additionSeed: initialSeed },
		get timelineWindow() {
			return timelineWindow(startingWorld.state.year, world.state.year, generationYears);
		},
		setRoofBuilder(value: NonNullable<typeof roofBuilder>) {
			input.control(() => (roofBuilder = value));
		},
		reportKernelFailure(error: unknown) {
			input.control(() => {
				console.error('Sandbox detailed roofs unavailable', error);
				actions.reject('kernel-start-failed');
			});
		},
		get focus() {
			return focus;
		},
		cycleFocus() {
			input.control(() => {
				const keys = Object.keys(focuses) as FocusId[];
				focus = keys[(keys.indexOf(focus) + 1) % keys.length];
			});
		},
		advance: () => input.control(actions.advance),
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
		pickMethod(method: BuildingMethod | (() => BuildingMethod | undefined)) {
			input.control(() => {
				const next = typeof method === 'function' ? method() : method;
				if (next && tool.kind === 'house' && methods.includes(next)) chosenMethod = next;
			});
		},
		selectTool,
		set tool(next: Tool) {
			selectTool(() => next);
		},
		get world() {
			return projected;
		},
		get gesture() {
			return stroke;
		},
		get hasPendingStroke() {
			return Boolean(pending);
		},
		get failure() {
			return state.rejection;
		},
		get canUndo() {
			return state.canUndo || Boolean(stroke || pending);
		},
		get canRedo() {
			return state.canRedo || Boolean(stroke || pending);
		},
		/** Starts tracing on the current city and holds world controls until release. */
		strokeStart(cellId: string | undefined) {
			const empty = { cellIds: [], lastPointerCellId: undefined };
			stroke = cellId ? traceStroke(world.grid, empty, cellId) : empty;
			input.hold();
		},
		strokeMove(cellId: string) {
			if (!stroke) return;
			const trace = traceStroke(world.grid, stroke, cellId);
			if (trace !== stroke) stroke = trace;
		},
		/** Reserves the city for the completed trace before scheduling its survey. */
		strokeRelease(): StrokeRelease | undefined {
			const trace = stroke;
			stroke = undefined;
			if (!trace?.cellIds.length) {
				input.cancel();
				return;
			}
			pending = trace;
			input.pause();
			return pending;
		},
		surveyRelease,
		/** Commits the retained plan, then resumes raw input. */
		commitRelease(release: StrokeRelease, beforeReplay?: () => void) {
			settleRelease(
				release,
				(plan) => actions.place(plan ?? planStroke(world, selectedTool, release.cellIds)),
				beforeReplay
			);
		},
		/** Rejects a failed preview and releases the same input lock as a commit. */
		rejectRelease(release: StrokeRelease, error: unknown, beforeReplay?: () => void) {
			settleRelease(
				release,
				() => {
					throw error;
				},
				beforeReplay
			);
		},
		strokeCancel() {
			stroke = undefined;
			input.cancel();
		},
		/** Drops native input and pending work when the canvas is disposed. */
		disposeInput() {
			stroke = pending = surveyed = undefined;
			input.clear();
		},
		undo: () => input.control(actions.undo),
		redo: () => input.control(actions.redo),
		restart: () => input.control(actions.restart),
		dismissRejection: () => input.control(actions.clearRejection)
	};
}

export type Session = ReturnType<typeof createSession>;
