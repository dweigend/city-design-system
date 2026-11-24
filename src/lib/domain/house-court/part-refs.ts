import type { Part, Shape } from '../../core/object';
import { createWorldReference, encodeKey, type Ref } from '../../core/ref';
import { required } from '../../core/invariant';
import { readStoreyRef } from '../cell-space';

export type StoreyRun = readonly [cellId: string, fromStorey: number, toStorey: number];
export type HousePart = Part & Readonly<{ runs: readonly StoreyRun[] }>;

export const groundStorey = /* Exact arithmetic: zero-based ground storey index. */ 0;

export function groundStoreyRuns(cellId: string): readonly StoreyRun[] {
	return [[cellId, groundStorey, groundStorey + 1]];
}

/** A part's identity and the addressed storeys it serves. The span end is exclusive.
 * Shared meshes report a null cellId and list the contributing storeys across their cells. */
export type HousePartRef = Readonly<{
	ref: Ref<'house-part'>;
	partId: string;
	slot: string;
	cellId: string | null;
	storeySpan: readonly [number, number];
	storeyRefs: readonly Ref<'storey'>[];
}>;

export function shapeParts(
	id: string,
	slot: string,
	shape: Shape | undefined,
	runs: readonly StoreyRun[]
): HousePart[] {
	return shape ? [{ id, slot, shape, runs }] : [];
}

export function partReferences(
	houseId: string,
	spaceId: string,
	parts: readonly HousePart[]
): readonly HousePartRef[] {
	return Object.freeze(
		parts.map(({ id, slot, runs }) => {
			const refs = new Map<string, Ref<'storey'>>();
			let from = Infinity;
			let to = -Infinity;
			const cellId = runs[0][0];
			for (const [cell, bottom, top] of runs) {
				from = Math.min(from, bottom);
				to = Math.max(to, top);
				for (let storey = bottom; storey < top; storey += 1) {
					const ref = readStoreyRef(spaceId, cell, storey);
					refs.set(ref.key, ref);
				}
			}
			return Object.freeze({
				ref: createWorldReference(
					required(refs.values().next().value, 'part storey').world,
					'house-part',
					encodeKey([houseId, id])
				),
				partId: id,
				slot,
				cellId: runs.every(([cell]) => cell === cellId) ? cellId : null,
				storeySpan: Object.freeze<[number, number]>([from, to]),
				storeyRefs: Object.freeze([...refs.values()])
			});
		})
	);
}
