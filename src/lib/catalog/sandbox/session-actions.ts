import {
	applyEdit,
	commit,
	openingScene,
	redo,
	startHistory,
	undo,
	withState,
	type StrokePlan,
	type Stroke,
	type World
} from '../logic/sandbox';
import type { Completion } from './feedback';

type SessionState = Readonly<{
	world: World;
	completion: Completion | undefined;
	rejection: Stroke['failure'];
	canUndo: boolean;
	canRedo: boolean;
}>;

/** Owns the committed city and publishes each successful edit to presentation subscribers. */
export function createSessionActions(
	initial: World,
	generationYears: number,
	publish: (state: SessionState) => void
) {
	let world = initial;
	let history = startHistory(initial.state);
	let completion: Completion | undefined;
	let rejection: Stroke['failure'];
	const listeners = new Set<(value: Completion) => void>();

	function snapshot(): SessionState {
		return {
			world,
			completion,
			rejection,
			canUndo: history.past.length > 0,
			canRedo: history.future.length > 0
		};
	}

	function edit(next: World, kind: Completion['kind'], cellIds: readonly string[] = []) {
		if (next === world) return;
		const event = { kind, before: world, after: next, cellIds };
		completion = event;
		world = next;
		history = commit(history, next.state);
		rejection = undefined;
		publish(snapshot());
		for (const listener of [...listeners]) listener(event);
	}

	function restore(next: typeof history) {
		if (next === history) return;
		world = withState(world, next.present);
		history = next;
		completion = undefined;
		rejection = undefined;
		publish(snapshot());
	}

	return {
		snapshot,
		/** Subscribes to the successful results, in order. */
		onCompletion(listener: (value: Completion) => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		/** Applies the one surveyed plan while the input buffer still owns the city. */
		place(plan: StrokePlan) {
			const { draft, failure } = plan.outcome();
			if (draft !== world) edit(draft, plan.tool.kind, plan.cellIds);
			else if (failure && !rejection) {
				rejection = failure;
				publish(snapshot());
			}
		},
		undo: () => restore(undo(history)),
		redo: () => restore(redo(history)),
		advance: () => edit(applyEdit(world, { kind: 'advance', years: generationYears }), 'advance'),
		/** Opens the next seed and clears its history. */
		restart() {
			world = openingScene(world.seed + 1).world;
			history = startHistory(world.state);
			completion = undefined;
			rejection = undefined;
			publish(snapshot());
		},
		/** Explicitly dismisses the current survey error. */
		clearRejection() {
			rejection = undefined;
			publish(snapshot());
		}
	};
}
