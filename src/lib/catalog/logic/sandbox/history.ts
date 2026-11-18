import type { SandboxState } from './state';

/** Undo steps kept; older steps fall away. */
const HISTORY_LIMIT = 200;

/**
 * Undo history of whole strokes. Undo and redo return exactly the saved states (PT-9);
 * states are immutable, so sharing them is safe.
 */
export type History = Readonly<{
	past: readonly SandboxState[];
	present: SandboxState;
	future: readonly SandboxState[];
}>;

export const startHistory = (present: SandboxState): History => ({
	past: [],
	present,
	future: []
});

/** Makes `next` the present. The same state is a no-op and returns the input. */
export function commit(history: History, next: SandboxState): History {
	if (next === history.present) return history;
	return {
		past: [...history.past, history.present].slice(-HISTORY_LIMIT),
		present: next,
		future: []
	};
}

/** One step back; at the start the input is returned. */
export function undo(history: History): History {
	const previous = history.past[history.past.length - 1];
	if (!previous) return history;
	return {
		past: history.past.slice(0, -1),
		present: previous,
		future: [history.present, ...history.future]
	};
}

/** One step forward; at the end the input is returned. */
export function redo(history: History): History {
	const [next, ...future] = history.future;
	if (!next) return history;
	return { past: [...history.past, history.present], present: next, future };
}
