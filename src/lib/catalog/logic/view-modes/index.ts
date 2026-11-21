import {
	displayModes,
	viewModes,
	type DisplayMode,
	type ViewMode,
	type ViewPolicy
} from '../../data/view-modes';

type ViewRequest = Readonly<{ view?: string; display?: string }>;
export type ResolvedView = Readonly<{ view: ViewMode; display: DisplayMode }>;

function select<T extends string>(
	known: readonly T[],
	allowed: readonly T[],
	fallback: T,
	requested?: string
) {
	if (!allowed.includes(fallback) || allowed.some((item) => !known.includes(item)))
		throw new RangeError('Invalid view policy');
	const selection = allowed.find((item) => item === (requested ?? fallback));
	if (selection === undefined) throw new RangeError('Unavailable view or display: ' + requested);
	return selection;
}

/** Validates a step policy and returns its immutable view, with defaults for omitted requests. */
export function resolveView(policy: ViewPolicy, request?: ViewRequest): ResolvedView {
	return Object.freeze({
		view: select(viewModes, policy.views, policy.view, request?.view),
		display: select(
			displayModes,
			policy.displays ?? [policy.display],
			policy.display,
			request?.display
		)
	});
}
