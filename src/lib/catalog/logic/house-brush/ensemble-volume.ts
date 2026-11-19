import type { Ensembles } from './ensemble';
import { storiesOf, type Stacks } from './stacks';

export type Volume = Readonly<{
	form: 'sockel' | 'body' | 'turm';
	start: number;
	end: number;
}>;

const CROWN_STOREYS = 2;

function occupiedInterval(floors: readonly unknown[], level: number, min: number, max: number) {
	let start = level;
	let end = level + 1;
	while (start > min && floors[start - 1] !== undefined) start--;
	while (end < max && floors[end] !== undefined) end++;
	return { start, end };
}

/** Maximal occupied interval within a plinth, body or two-storey crown, end exclusive. */
export function volumeAt(
	stacks: Stacks,
	ensembles: Ensembles | undefined,
	id: string,
	level: number
): Volume | undefined {
	const parcel = ensembles?.cells.get(id);
	if (!parcel?.neighbors.length) return;
	const floors = storiesOf(stacks, id);
	if (floors[level] === undefined) return;
	if (level === 0) return { form: 'sockel', start: 0, end: 1 };
	const crown = parcel.role === 'turm' ? Math.max(2, parcel.height - CROWN_STOREYS) : Infinity;
	const isCrown = level >= crown;
	const min = isCrown ? crown : 1;
	const max = isCrown ? floors.length : Math.min(crown, floors.length);
	return { form: isCrown ? 'turm' : 'body', ...occupiedInterval(floors, level, min, max) };
}
