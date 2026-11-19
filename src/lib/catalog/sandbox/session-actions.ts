import {
	applyEdit,
	regenerateHouse,
	commit,
	redo,
	setFutureTarget,
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
	publish: (state: SessionState) => void,
	open: (seed: number) => World
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
		history = commit(history, next.state);
		completion = event;
		world = next;
		if (kind !== 'advance') rejection = undefined;
		publish(snapshot());
		for (const listener of [...listeners]) {
			try {
				listener(event);
			} catch (error) {
				console.error('Sandbox completion listener failed', error);
			}
		}
	}

	function restore(next: typeof history) {
		if (next === history) return;
		world = withState(world, next.present);
		history = next;
		completion = undefined;
		publish(snapshot());
	}

	return {
		snapshot,
		/** Subscribes to the successful results, in order. */
		onCompletion(this: void, listener: (value: Completion) => void) {
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
		/** Saves the planning target as a history step without a construction event. */
		toggleSpongeCity() {
			const next = setFutureTarget(world, world.state.futureTarget ? undefined : 'sponge-city');
			world = next;
			history = commit(history, next.state);
			completion = undefined;
			publish(snapshot());
		},
		regenerate: (id: string) => edit(regenerateHouse(world, id), 'house'),
		undo: () => restore(undo(history)),
		redo: () => restore(redo(history)),
		advanceFrom(snapshot: World, next: World) {
			if (world === snapshot) edit(next, 'advance');
		},
		advance: () => edit(applyEdit(world, { kind: 'advance', years: generationYears }), 'advance'),
		/** Opens the next seed and clears its history. */
		restart(this: void) {
			world = open(world.seed + 1);
			history = startHistory(world.state);
			completion = undefined;
			publish(snapshot());
		},
		/** Publishes a recoverable error for either the stroke or the detailed roof loader. */
		reject(reason: 'stroke-failed' | 'kernel-start-failed') {
			rejection = { reason, marks: [] };
			publish(snapshot());
		},
		/** Explicitly dismisses the current survey error. */
		clearRejection(this: void) {
			rejection = undefined;
			publish(snapshot());
		}
	};
}
