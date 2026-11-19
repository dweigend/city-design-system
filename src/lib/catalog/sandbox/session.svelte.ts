import { sandboxGenerationYears, type BuildingMethod } from '../data/sandbox';
import type { StrokeRelease } from './feedback';
import { createSessionActions } from './session-actions';
import { createSerialInput } from './serial-input';
import { focuses, type FocusId } from '../logic/presentation';
import {
	prepareAdvance,
	type sizeFrameSites,
	openingScene,
	planStroke,
	traceStroke,
	type Stroke,
	type StrokePlan,
	type Tool,
	stylesForYear,
	timelineWindow,
	timelineYear
} from '../logic/sandbox';

/**
 * Reactive session of one sandbox: the world, the tool, the stroke in progress and the undo
 * history. View state for the components; every change of the world goes through the actions
 * of logic/sandbox.
 */
export function createSession(
	initialSeed: number,
	generationYears = sandboxGenerationYears,
	open = openingScene,
	size?: (sites: Parameters<typeof sizeFrameSites>[0]) => Promise<ReturnType<typeof sizeFrameSites>>
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
	let preview = $state.raw<typeof startingWorld>();
	const shown = $derived(preview ?? state.reviewed ?? world);
	const projected = $derived(roofBuilder ? { ...shown, roofBuilder } : shown);
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
	let plan = $state(false);
	let request = $state.raw<{ label: string }>();

	/** Publishes the latest requested choice until its command is replayed. */
	function control(run: () => void, label?: string) {
		const choice = label ? { label } : undefined;
		if (choice) request = choice;
		input.control(() => {
			try {
				run();
			} finally {
				if (request === choice) request = undefined;
			}
		});
	}

	/** Resolves options at replay time, after any preceding tool choices. */
	function selectTool(choose: () => Tool, label?: string) {
		control(() => (tool = choose()), label);
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

	function advance() {
		if (state.reviewed) return;
		if (!size) return actions.advance();
		const source = world;
		const work = prepareAdvance(source, generationYears);
		preview = work.preview();
		const publication = preview;
		input.pause();
		function commit(proofs?: ReturnType<typeof sizeFrameSites>) {
			if (preview !== publication) return;
			input.finish(() => {
				preview = undefined;
				actions.advanceFrom(source, work.finish(proofs));
			});
		}
		void size(work.sites).then(commit, () => commit());
	}

	return {
		input: input.pointer,
		get plan() {
			return plan;
		},
		/** Changes the picking projection at the same point as other queued controls. */
		togglePlan: () => control(() => (plan = !plan), 'Plan view'),
		get requestedChoice() {
			return request?.label;
		},
		get completion() {
			return completion;
		},
		onCompletion: actions.onCompletion,
		opening: { additions, additionSeed: initialSeed },
		get timelineWindow() {
			const year = world.state.year;
			const range = timelineWindow(startingWorld.state.year, year, generationYears);
			return year > range.min ? { min: range.min, max: year } : range;
		},
		get timelineState() {
			return world.state;
		},
		get shownYear() {
			return (state.reviewed ?? world).state.year;
		},
		get viewingPast() {
			return state.reviewed !== undefined;
		},
		generationYears,
		/** Selects a saved generation on the current branch in input order. */
		reviewYear(this: void, value: number) {
			control(() => {
				actions.reviewYear(
					timelineYear(value, startingWorld.state.year, world.state.year, generationYears)
				);
			});
		},
		setRoofBuilder(this: void, value: NonNullable<typeof roofBuilder>) {
			input.control(() => (roofBuilder = value));
		},
		reportKernelFailure(this: void, error: unknown) {
			input.control(() => {
				console.error('Sandbox detailed roofs unavailable', error);
				actions.reject('kernel-start-failed');
			});
		},
		get focus() {
			return focus;
		},
		cycleFocus(this: void) {
			control(() => {
				const keys = Object.keys(focuses) as FocusId[];
				focus = keys[(keys.indexOf(focus) + 1) % keys.length];
			}, 'Focus');
		},
		advance: () => control(advance, 'Advance'),
		get spongeCity() {
			return world.state.futureTarget === 'sponge-city';
		},
		/** Replays the target toggle in input order with advances and strokes. */
		toggleSpongeCity: () =>
			control(() => {
				if (!state.reviewed) actions.toggleSpongeCity();
			}, 'Sponge city'),
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
		pickMethod(method: BuildingMethod | (() => BuildingMethod | undefined), label?: string) {
			control(() => {
				const next = typeof method === 'function' ? method() : method;
				if (
					next &&
					methods.includes(next) &&
					(typeof method !== 'function' || tool.kind === 'house')
				)
					chosenMethod = next;
			}, label);
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
			if (state.reviewed) return;
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
		strokeCancel(this: void) {
			stroke = undefined;
			input.cancel();
		},
		/** Drops native input and pending work when the canvas is disposed. */
		disposeInput() {
			preview = undefined;
			stroke = pending = surveyed = undefined;
			request = undefined;
			input.clear();
		},
		undo: () => control(actions.undo, 'Undo'),
		redo: () => control(actions.redo, 'Redo'),
		restart: () => control(actions.restart, 'New terrain'),
		dismissRejection: () => input.control(actions.clearRejection)
	};
}

export type Session = ReturnType<typeof createSession>;
