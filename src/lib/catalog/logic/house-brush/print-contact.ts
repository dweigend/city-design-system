import { STORY } from '../../data/grid';
import type { QuadCell } from '../quad-grid';
import { floorOf, type Mass, type Story } from './massing';
import { storiesOf, type HouseUse, type Stacks } from './stacks';

/** Looks up whether a story has a visible print wall and when it was placed. */
export type PrintOrder = (cell: QuadCell, level: number) => number | undefined;

/** Uses stack insertion order for callers without a saved placement history. */
export function stackPrintOrder(stacks: Stacks): PrintOrder {
	const order = new Map([...stacks.keys()].map((id, index) => [id, index]));
	return (cell) => order.get(cell.id);
}

export type Contact = { use: HouseUse; bottom: number; top: number };

/** Returns an upper ink for a lap on the top half meter of the lower wall. */
export function lapInk(stacks: Stacks, mass: Mass, story: Story, order: PrintOrder) {
	const upper = storiesOf(stacks, story.cell.id)[story.level + 1];
	return upper && upper !== mass.use && order(story.cell, story.level + 1) !== undefined
		? upper
		: undefined;
}

/** Returns the facing height intervals where this parcel was placed after a different ink. */
export function abuttingInks(
	stacks: Stacks,
	mass: Mass,
	story: Story,
	neighbor: QuadCell | undefined,
	order: PrintOrder
): Contact[] {
	const placed = order(story.cell, story.level);
	if (!neighbor || placed === undefined) return [];
	return storiesOf(stacks, neighbor.id).flatMap((use, level) => {
		const earlier = order(neighbor, level);
		if (use === mass.use || earlier === undefined || earlier >= placed) return [];
		const bottom = Math.max(mass.floor, floorOf(neighbor, level));
		const top = Math.min(mass.floor + STORY, floorOf(neighbor, level + 1));
		return top > bottom ? [{ use, bottom, top }] : [];
	});
}
