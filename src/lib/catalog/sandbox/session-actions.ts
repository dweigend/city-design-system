import {
	applyEdit,
	commit,
	openingScene,
	planStroke,
	redo,
	startHistory,
	strokePlanKey,
	undo,
	withState,
	type Stroke,
	type World
} from '../logic/sandbox';
import type { Completion, StrokeRelease } from './feedback';

type Command =
	| { kind: 'stroke'; release: StrokeRelease; ready: boolean }
	| {
			kind: 'undo' | 'redo' | 'advance';
	  }
	| { kind: 'restart' };

type SessionState = Readonly<{
	world: World;
	completion: Completion | undefined;
	rejection: Stroke['failure'];
	canUndo: boolean;
	canRedo: boolean;
}>;

/** Owns the committed world, history and FIFO for released strokes and edit commands. */
export function createSessionActions(
	initial: World,
	generationYears: number,
	publish: (state: SessionState) => void
) {
	let world = initial;
	let history = startHistory(initial.state);
	let completion: Completion | undefined;
	let rejection: Stroke['failure'];
	const queue: Command[] = [];
	const completionListeners = new Set<(value: Completion) => void>();
	let draining = false;

	function snapshot(): SessionState {
		return {
			world,
			completion,
			rejection,
			canUndo: history.past.length > 0 || queue.some(({ kind }) => kind === 'stroke'),
			canRedo: history.future.length > 0 || queue.some(({ kind }) => kind === 'undo')
		};
	}

	function edit(next: World, kind: Completion['kind'], cellIds: readonly string[] = []) {
		if (next === world) return;
		const event = { kind, before: world, after: next, cellIds };
		completion = event;
		world = next;
		history = commit(history, next.state);
		for (const listener of [...completionListeners]) listener(event);
	}

	function restore(next: typeof history) {
		if (next === history) return;
		world = withState(world, next.present);
		history = next;
		completion = undefined;
	}

	function place(release: StrokeRelease) {
		const { base, tool, cellIds } = release;
		if (base.seed !== world.seed) return;
		const current = planStroke(world, tool, cellIds);
		// The same immutable simulation inputs guarantee the same result.
		const sameWorld = base.state === world.state && base.grid === world.grid;
		if (!sameWorld && strokePlanKey(release) !== strokePlanKey(current)) return;
		const { draft, failure } = current.outcome();
		rejection = failure;
		edit(draft, tool.kind, cellIds);
	}

	function execute(command: Command) {
		rejection = undefined;
		switch (command.kind) {
			case 'stroke':
				return place(command.release);
			case 'undo':
				return restore(undo(history));
			case 'redo':
				return restore(redo(history));
			case 'advance':
				return edit(applyEdit(world, { kind: 'advance', years: generationYears }), 'advance');
			case 'restart':
				world = openingScene(world.seed + 1).world;
				history = startHistory(world.state);
				completion = undefined;
		}
	}

	function drain() {
		if (draining) return;
		draining = true;
		try {
			while (queue.length) {
				const command = queue[0];
				if (command.kind === 'stroke' && !command.ready) break;
				queue.shift();
				execute(command);
			}
		} finally {
			draining = false;
		}
		publish(snapshot());
	}

	function enqueue(command: Exclude<Command, { kind: 'stroke' }>) {
		queue.push(command);
		drain();
	}

	return {
		snapshot,
		/** Delivers each completed edit before the next queued command executes. */
		onCompletion(listener: (value: Completion) => void) {
			completionListeners.add(listener);
			return () => {
				completionListeners.delete(listener);
			};
		},
		/** Reserves the shown plan; validation runs in command order after earlier edits. */
		release(release: StrokeRelease) {
			if (release.base.seed !== world.seed) return false;
			if (queue.some(({ kind }) => kind === 'restart')) return false;
			queue.push({ kind: 'stroke', release, ready: false });
			drain();
			return true;
		},
		/** Marks this stroke ready to commit after feedback. Earlier commands still go first. */
		commitRelease(release: StrokeRelease) {
			for (const command of queue) {
				if (command.kind !== 'stroke' || command.release !== release) continue;
				command.ready = true;
				drain();
				return;
			}
		},
		undo: () => enqueue({ kind: 'undo' }),
		redo: () => enqueue({ kind: 'redo' }),
		advance: () => enqueue({ kind: 'advance' }),
		restart: () => enqueue({ kind: 'restart' }),
		/** Clears the last survey mark when switching tools or construction methods. */
		clearRejection() {
			rejection = undefined;
			publish(snapshot());
		}
	};
}
