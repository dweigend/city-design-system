import type { Part, Shape } from '../../core/object';
import { encodeKey, type Ref } from '../../core/ref';
import { readStoreyKey } from '../cell-space';

export type StoreyRun = readonly [cellId: string, fromStorey: number, toStorey: number];
export type HousePart = Part & Readonly<{ runs: readonly StoreyRun[] }>;

export const groundStorey = /* Exact arithmetic: zero-based ground storey index. */ 0;

export function groundStoreyRuns(cellId: string): readonly StoreyRun[] {
	return [[cellId, groundStorey, groundStorey + 1]];
}

/** A part's identity and the addressed storeys it serves. The span end is exclusive.
 * Shared meshes report a null cellId and list the contributing storeys across their cells. */
export type HousePartAddress = Readonly<{
	key: string;
	partId: string;
	slot: string;
	cellId: string | null;
	storeySpan: readonly [number, number];
	storeyKeys: readonly string[];
}>;

/** Part and storey addresses resolved in one supplied world. */
export type HousePartRef = Omit<HousePartAddress, 'key' | 'storeyKeys'> &
	Readonly<{ ref: Ref<'house-part'>; storeyRefs: readonly Ref<'storey'>[] }>;

export function shapeParts(
	id: string,
	slot: string,
	shape: Shape | undefined,
	runs: readonly StoreyRun[]
): HousePart[] {
	return shape ? [{ id, slot, shape, runs }] : [];
}

export function partAddresses(
	houseId: string,
	spaceId: string,
	parts: readonly HousePart[]
): readonly HousePartAddress[] {
	return Object.freeze(
		parts.map(({ id, slot, runs }) => {
			const keys = new Set<string>();
			let from = Infinity;
			let to = -Infinity;
			const cellId = runs[0][0];
			for (const [cell, bottom, top] of runs) {
				from = Math.min(from, bottom);
				to = Math.max(to, top);
				for (let storey = bottom; storey < top; storey += 1)
					keys.add(readStoreyKey(spaceId, cell, storey));
			}
			return Object.freeze({
				key: encodeKey([houseId, id]),
				partId: id,
				slot,
				cellId: runs.every(([cell]) => cell === cellId) ? cellId : null,
				storeySpan: Object.freeze<[number, number]>([from, to]),
				storeyKeys: Object.freeze([...keys])
			});
		})
	);
}
