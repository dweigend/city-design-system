import {
	applyEdit,
	applyStroke,
	commit,
	openingScene,
	redo,
	startHistory,
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
		completion = { kind, before: world, after: next, cellIds };
		world = next;
		history = commit(history, next.state);
		for (const listener of completionListeners) listener(completion);
	}

	function restore(next: typeof history) {
		if (next === history) return;
		world = withState(world, next.present);
		history = next;
		completion = undefined;
	}

	function matches({ base }: StrokeRelease) {
		return base.seed === world.seed && base.state === world.state;
	}

	function place(release: StrokeRelease) {
		if (!matches(release)) return;
		const { tool, cellIds } = release;
		const { draft, failure } = applyStroke(world, tool, cellIds);
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
		while (queue.length) {
			const command = queue[0];
			if (command.kind === 'stroke' && !command.ready) break;
			queue.shift();
			execute(command);
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
		/** Reserves a stroke only if its displayed world still belongs at the end of the queue. */
		release(release: StrokeRelease) {
			if (!matches(release)) return false;
			if (queue.some(({ kind }) => kind === 'restart')) return false;
			queue.push({ kind: 'stroke', release, ready: false });
			publish(snapshot());
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
