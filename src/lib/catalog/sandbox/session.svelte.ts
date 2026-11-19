import { sandboxGenerationYears, type BuildingMethod } from '../data/sandbox';
import { focuses, type FocusId } from '../logic/presentation';
import {
	applyEdit,
	beginStroke,
	commit,
	createWorld,
	extendStroke,
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
	const startingWorld = createWorld(initialSeed);
	/** The committed world; its derived grid is the session's cache (PT-14). */
	let world = $state.raw(startingWorld);
	let history = $state.raw(startHistory(startingWorld.state));
	let stroke = $state.raw<Stroke>();
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
		history = next;
		world = withState(world, next.present);
	}

	return {
		get timelineWindow() {
			return timelineWindow(startingWorld.state.year, world.state.year, generationYears);
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
			world = applyEdit(world, { kind: 'advance', years: generationYears });
			history = commit(history, world.state);
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
		/** The world to show: the draft of the running stroke, else the committed world. */
		get world() {
			return stroke?.draft ?? world;
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
		strokeStart(cellId: string) {
			stroke = extendStroke(beginStroke(selectedTool, world), cellId);
		},
		strokeMove(cellId: string) {
			if (stroke) stroke = extendStroke(stroke, cellId);
		},
		strokeEnd() {
			if (stroke) {
				rejection = stroke.failure;
				world = stroke.draft;
				history = commit(history, world.state);
			}
			stroke = undefined;
		},
		undo: () => restore(undo(history)),
		redo: () => restore(redo(history)),
		/** New terrain from a seed; the built city starts with its seeded town. */
		restart(seed: number) {
			stroke = undefined;
			rejection = undefined;
			world = createWorld(seed);
			history = startHistory(world.state);
		}
	};
}

export type Session = ReturnType<typeof createSession>;
