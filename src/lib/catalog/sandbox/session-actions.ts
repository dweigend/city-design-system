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
	| { kind: 'restart'; seed: number };

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
	}

	function restore(next: typeof history) {
		if (next === history) return;
		world = withState(world, next.present);
		history = next;
		completion = undefined;
	}

	function place(release: StrokeRelease) {
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
				world = openingScene(command.seed).world;
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
		/** Reserves a stroke's position before its first feedback frame. */
		release(release: StrokeRelease) {
			queue.push({ kind: 'stroke', release, ready: false });
			publish(snapshot());
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
		restart: (seed: number) => enqueue({ kind: 'restart', seed }),
		/** Clears the last survey mark when switching tools or construction methods. */
		clearRejection() {
			rejection = undefined;
			publish(snapshot());
		}
	};
}
