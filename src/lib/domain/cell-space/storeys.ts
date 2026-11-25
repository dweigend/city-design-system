import { createWorldReference, encodeKey } from '../../core/ref';
import { defaults } from '../../../config/cell-space';
import type { CellSpace, StoreySizing, StoreyStack } from './types';

function requireIndex(index: number, count = Infinity) {
	if (!Number.isSafeInteger(index) || index < 0 || index >= count)
		throw new RangeError('Expected a storey index in range');
}

/** Reads just the requested boundary window of a repeating mixed stack. */
export function createMixedStoreyBoundaries(
	datumZ: number,
	heights: readonly number[],
	cycleHeightM: number,
	first: number,
	count: number
): number[] {
	if (
		!heights.length ||
		!Number.isSafeInteger(first) ||
		!Number.isSafeInteger(count) ||
		count < 0 ||
		!Number.isSafeInteger(first + count)
	)
		throw new RangeError('Expected a safe mixed-storey window');
	const bands = heights.length;
	let cycle = Math.floor(first / bands);
	let band = first - cycle * bands;
	let offset = cycle * cycleHeightM;
	for (let index = 0; index < band; index++) offset += heights[index];
	const boundaries = [datumZ + offset];
	for (let index = 0; index < count; index++) {
		if (band + 1 === bands) {
			cycle++;
			band = /* Exact arithmetic: the first band of the next cycle. */ 0;
			offset = cycle * cycleHeightM;
		} else {
			offset += heights[band];
			band++;
		}
		boundaries.push(datumZ + offset);
	}
	return boundaries;
}

/** Creates a detached stack of storey heights and their absolute boundary elevations. */
export function createStoreyStack({
	baseZ,
	storeyCount,
	datumIndex = /* Exact arithmetic: a standalone stack begins at its own datum. */ 0,
	storeyHeightM,
	storeyHeightsM,
	storeyElevationsM
}: StoreySizing): StoreyStack {
	if (!Number.isFinite(baseZ)) throw new RangeError('baseZ must be finite');
	if (!Number.isSafeInteger(storeyCount) || storeyCount < 1)
		throw new RangeError('A cell space needs at least one storey');
	if (!Number.isSafeInteger(datumIndex) || !Number.isSafeInteger(datumIndex + storeyCount))
		throw new RangeError('Expected a safe range of datum indices');
	if (
		storeyElevationsM &&
		(storeyElevationsM[0] !== baseZ || storeyElevationsM.length !== storeyCount + 1)
	)
		throw new RangeError('Expected the boundaries of the active storey window');
	if (storeyHeightsM !== undefined && storeyHeightsM.length !== storeyCount)
		throw new RangeError('Expected one height per storey');
	if (storeyHeightM !== undefined && !(Number.isFinite(storeyHeightM) && storeyHeightM > 0))
		throw new RangeError('Storey height must be a positive finite length');
	const heights =
		storeyHeightsM === undefined
			? Array<number>(storeyCount).fill(storeyHeightM ?? defaults.storeyHeightM)
			: [...storeyHeightsM];
	if (heights.some((height) => !(Number.isFinite(height) && height > 0)))
		throw new RangeError('Storey heights must be positive finite lengths');
	const uniform = heights.every((height) => height === heights[0]) ? heights[0] : undefined;
	if (storeyHeightM !== undefined && storeyHeightM !== uniform)
		throw new RangeError('Uniform storey height disagrees with the stack');
	const elevations = storeyElevationsM
		? [...storeyElevationsM]
		: uniform === undefined
			? createMixedStoreyBoundaries(
					baseZ,
					heights,
					heights.reduce((sum, height) => sum + height, 0),
					/* Exact arithmetic: an uncut stack starts at its first boundary. */ 0,
					storeyCount
				)
			: Array.from({ length: storeyCount + 1 }, (_, index) => baseZ + index * uniform);
	for (const [index, height] of heights.entries()) {
		const top = elevations[index + 1];
		if (!Number.isFinite(top) || top <= elevations[index])
			throw new RangeError('Storey boundaries must increase at the given datum');
		if (storeyElevationsM) {
			const bottom = elevations[index];
			// Two rounded elevations and their difference can each contribute rounding error.
			const tolerance =
				/* Exact arithmetic: three rounded operations. */ 3 *
				Number.EPSILON *
				Math.max(Math.abs(bottom), Math.abs(top), height);
			if (Math.abs(top - bottom - height) > tolerance)
				throw new RangeError('Storey boundaries disagree with the declared heights');
		}
	}
	return Object.freeze({
		baseZ,
		storeyCount,
		datumIndex,
		storeyHeightM: uniform,
		storeyHeightsM: Object.freeze(heights),
		storeyElevationsM: Object.freeze(elevations)
	});
}

/** Absolute elevation of a storey boundary, including the roof above the last storey. */
export function readStoreyElevation(space: StoreyStack, index: number): number {
	requireIndex(index, space.storeyCount + 1);
	const shift = space.baseZ - space.storeyElevationsM[0];
	if (shift === 0) return space.storeyElevationsM[index];
	return space.storeyHeightM === undefined
		? space.storeyElevationsM[index] + shift
		: space.baseZ + index * space.storeyHeightM;
}

/** Recipe height of a storey, indexed from zero. */
export function readStoreyHeight(space: StoreyStack, index: number): number {
	requireIndex(index, space.storeyCount);
	return space.storeyHeightM ?? space.storeyHeightsM[index];
}

/** Stable address of a storey in one fine cell. */
export function readStoreyRef(spaceId: string, cellId: string, datumIndex: number, world: string) {
	return createWorldReference(world, 'storey', readStoreyKey(spaceId, cellId, datumIndex));
}

/** World-independent tuple key for a storey. */
export function readStoreyKey(spaceId: string, cellId: string, datumIndex: number) {
	if (!Number.isSafeInteger(datumIndex)) throw new RangeError('Expected a datum index');
	return encodeKey([spaceId, cellId, 'd', datumIndex]);
}

/** Storeys in cell order, then from bottom to top, with references in the supplied world. */
export function readCellStoreys(space: CellSpace, world: string) {
	return Object.freeze(
		space.storeys.map((storey) =>
			Object.freeze({
				...storey,
				ref: createWorldReference(world, 'storey', storey.key)
			})
		)
	);
}

function cellStoreys(space: CellSpace) {
	return Object.freeze(
		space.cells.flatMap(({ id: cellId }) =>
			Array.from({ length: space.storeyCount }, (_, storey) =>
				Object.freeze({
					key: readStoreyKey(space.id, cellId, space.datumIndex + storey),
					cellId,
					storey,
					datumIndex: space.datumIndex + storey,
					bottomZ: readStoreyElevation(space, storey),
					topZ: readStoreyElevation(space, storey + 1),
					heightM: readStoreyHeight(space, storey)
				})
			)
		)
	);
}

/** Keeps the existing plan subdivision and replaces its vertical sizing. */
export function createCellSpaceStoreys(
	space: Pick<CellSpace, 'id' | 'kind' | 'houseRules' | 'cells'>,
	sizing: StoreySizing
): CellSpace {
	const { id, kind, houseRules, cells } = space;
	let storeys: CellSpace['storeys'] | undefined;
	const result: CellSpace = Object.freeze({
		id,
		...(kind ? { kind } : {}),
		...(houseRules ? { houseRules: Object.freeze({ ...houseRules }) } : {}),
		...(sizing.datumIndex !== undefined ? { datumAnchored: true as const } : {}),
		...createStoreyStack(sizing),
		cells,
		get storeys() {
			return (storeys ??= cellStoreys(result));
		}
	});
	return result;
}
