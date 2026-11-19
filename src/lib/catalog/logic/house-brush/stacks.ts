import type { HouseUse, Stacks } from '../../data/house-body';
export type { HouseUse, Stacks } from '../../data/house-body';

/** Most stories one cell carries. */
export const MAX_STORIES = 12;

const NONE: readonly HouseUse[] = [];

/** Stories of a cell from the ground up; empty for an unbuilt cell. Reference into `stacks`. */
export const storiesOf = (stacks: Stacks, cellId: string): readonly HouseUse[] =>
	stacks.get(cellId) ?? NONE;

/**
 * Adds one story of `use` on top of a cell. Returns a new map; at {@link MAX_STORIES} the
 * input is returned unchanged (no-op, PT-7).
 */
export function raise(stacks: Stacks, cellId: string, use: HouseUse): Stacks {
	const stories = storiesOf(stacks, cellId);
	if (stories.length >= MAX_STORIES) return stacks;
	return new Map(stacks).set(cellId, [...stories, use]);
}

/** Removes the top story of a cell. Returns a new map; an unbuilt cell returns the input. */
export function lower(stacks: Stacks, cellId: string): Stacks {
	const stories = storiesOf(stacks, cellId);
	if (!stories.length) return stacks;
	const next = new Map(stacks);
	if (stories.length === 1) next.delete(cellId);
	else next.set(cellId, stories.slice(0, -1));
	return next;
}
