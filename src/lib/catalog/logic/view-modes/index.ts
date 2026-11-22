import {
	displayModes,
	viewModes,
	type DisplayMode,
	type ViewMode,
	type ViewPolicy
} from '../../data/view-modes';

export type ViewRequest = Readonly<{ view?: string; display?: string }>;
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

/** A vertical cut in world meters, retaining points where dot(normal, point) <= offsetM. */
export type SectionPlane = Readonly<{
	normal: readonly [number, number, 0];
	offsetM: number;
}>;

/** Constructs a vertical section through a world point with a unit horizontal normal. */
export function sectionThrough(
	point: readonly [number, number, number],
	normal: readonly [number, number]
): SectionPlane {
	const length = Math.hypot(...normal);
	if (!Number.isFinite(length) || length === 0 || !point.every(Number.isFinite))
		throw new RangeError('Invalid section plane');
	const x = normal[0] / length;
	const y = normal[1] / length;
	return Object.freeze({
		normal: Object.freeze([x, y, 0] as const),
		offsetM: x * point[0] + y * point[1]
	});
}
