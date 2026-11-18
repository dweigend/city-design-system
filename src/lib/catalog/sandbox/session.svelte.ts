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
	type Tool
} from '../logic/sandbox';

/**
 * Reactive session of one sandbox: the world, the tool, the stroke in progress and the undo
 * history. View state for the components; every change of the world goes through the actions
 * of logic/sandbox.
 */
export function createSession(initialSeed: number) {
	/** The committed world; its derived grid is the session's cache (PT-14). */
	let world = $state.raw(createWorld(initialSeed));
	let history = $state.raw(startHistory(world.state));
	let stroke = $state.raw<Stroke>();
	let tool = $state.raw<Tool>({ kind: 'house', use: 'living' });

	let focus = $state<FocusId>('all');
	function restore(next: typeof history) {
		history = next;
		world = withState(world, next.present);
	}

	return {
		get focus() {
			return focus;
		},
		cycleFocus() {
			const keys = Object.keys(focuses) as FocusId[];
			focus = keys[(keys.indexOf(focus) + 1) % keys.length];
		},
		advance() {
			if (stroke) return;
			world = applyEdit(world, { kind: 'advance' });
			history = commit(history, world.state);
		},
		get tool() {
			return tool;
		},
		set tool(next: Tool) {
			tool = next;
		},
		/** The world to show: the draft of the running stroke, else the committed world. */
		get world() {
			return stroke?.draft ?? world;
		},
		get canUndo() {
			return history.past.length > 0;
		},
		get canRedo() {
			return history.future.length > 0;
		},
		strokeStart(cellId: string) {
			stroke = extendStroke(beginStroke(tool, world), cellId);
		},
		strokeMove(cellId: string) {
			if (stroke) stroke = extendStroke(stroke, cellId);
		},
		strokeEnd() {
			if (stroke) {
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
			world = createWorld(seed);
			history = startHistory(world.state);
		}
	};
}

export type Session = ReturnType<typeof createSession>;
