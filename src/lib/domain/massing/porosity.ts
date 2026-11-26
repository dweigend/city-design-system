import { Random, uint32Limit } from '../../core/random';
import { readStoreyKey, type CellSpace } from '../cell-space';
import { onParcelEdge } from './graph';
import {
	columnsOf,
	removeSlice,
	snapshot,
	supports,
	type Column,
	type Columns,
	type Massing
} from './massing';

/** Target fraction of slices above their column foot, with an optional uint32 seed. */
export type PorosityOptions = Readonly<{ ratio: number; seed?: number }>;

/** One removed slice at its original cell and datum address. */
export type MassingVoid = Readonly<{
	cellId: string;
	storey: number;
	datumIndex: number;
	key: string;
	kind: 'terrace' | 'pass-through';
}>;

type Candidate = Omit<MassingVoid, 'kind'> & { column: Column; rank: number };

function voidKind(
	columns: Columns,
	column: Column,
	storey: number
): MassingVoid['kind'] | undefined {
	if ([...column.occupied].every((other) => other <= storey)) return 'terrace';
	const openSides = column.sides.filter((side) =>
		side.neighbour === null
			? onParcelEdge(side)
			: !columns.get(side.neighbour)?.occupied.has(storey)
	);
	if (openSides.length >= /* Exact arithmetic: a passage needs two openings. */ 2)
		return 'pass-through';
}

function carveIfSupported(columns: Columns, column: Column, storey: number): boolean {
	const anchor = column.anchoredTo;
	// Only the edited column and its neighbours can lose direct support from this cut.
	removeSlice(column, storey);
	const affected = column.sides.flatMap(({ neighbour }) => {
		const side = neighbour === null ? undefined : columns.get(neighbour);
		return side ? [side] : [];
	});
	const supported = [column, ...affected].every((side) =>
		[...side.occupied].every((level) => level < storey || supports(columns, side, level))
	);
	if (!supported) {
		column.occupied.add(storey);
		column.anchoredTo = anchor;
	}
	return supported;
}

function carveVoids(columns: Columns, candidates: Candidate[], target: number): MassingVoid[] {
	const voids: MassingVoid[] = [];
	let remaining = candidates;
	while (voids.length < target && remaining.length) {
		const deferred: Candidate[] = [];
		for (const candidate of remaining) {
			const { cellId, column, storey, datumIndex, key } = candidate;
			const kind = voidKind(columns, column, storey);
			if (kind && carveIfSupported(columns, column, storey)) {
				voids.push(Object.freeze({ cellId, storey, datumIndex, key, kind }));
				if (voids.length === target) return voids;
			} else deferred.push(candidate);
		}
		// An open roof or side can make a previously blocked slice eligible.
		if (deferred.length === remaining.length) break;
		remaining = deferred;
	}
	return voids;
}

/** Carves up to the rounded target share of upper slices, preserving the ground and column feet.
 * Returns frozen massing and voids (in carving order). The house seed is the default. A zero
 * ratio returns the input massing. Invalid ratios, seeds or mismatched spaces throw RangeError. */
export function createPorousMassing(
	space: CellSpace,
	massing: Massing,
	{ ratio, seed = massing.base.inputs.seed }: PorosityOptions
): Readonly<{ massing: Massing; voids: readonly MassingVoid[] }> {
	if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1)
		throw new RangeError('Porosity ratio must be between zero and one');
	if (!Number.isInteger(seed) || seed < 0 || seed >= uint32Limit)
		throw new RangeError('Porosity seed must be a uint32');
	const columns = columnsOf(space, massing);
	if (ratio === 0) return Object.freeze({ massing, voids: Object.freeze([]) });
	const random = Random.create({ seed });
	const candidates = [...columns].flatMap(([cellId, column]) =>
		[...column.occupied]
			.filter((storey) => storey > column.base.fromStorey)
			.map((storey) => {
				const datumIndex = space.datumIndex + storey;
				const key = readStoreyKey(space.id, cellId, datumIndex);
				return {
					cellId,
					column,
					storey,
					datumIndex,
					key,
					rank: random.derive('porosity/' + key).number()
				};
			})
	);
	const target = Math.round(ratio * candidates.length);
	candidates.sort((a, b) => a.rank - b.rank || Number(a.key > b.key) - Number(a.key < b.key));
	const voids = carveVoids(columns, candidates, target);
	return Object.freeze({ massing: snapshot(massing, columns), voids: Object.freeze(voids) });
}
