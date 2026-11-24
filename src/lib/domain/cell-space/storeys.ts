import { createWorldReference, encodeKey } from '../../core/ref';
import { defaults } from '../../../config/cell-space';
import type { CellSpace, StoreySizing, StoreyStack } from './types';

const worldScope = 'city';

function requireIndex(index: number, count = Infinity) {
	if (!Number.isSafeInteger(index) || index < 0 || index >= count)
		throw new RangeError('Expected a storey index in range');
}

/** Creates a detached stack of storey heights and their absolute boundary elevations. */
export function createStoreyStack({
	baseZ,
	storeyCount,
	storeyHeightM,
	storeyHeightsM
}: StoreySizing): StoreyStack {
	if (!Number.isFinite(baseZ)) throw new RangeError('baseZ must be finite');
	if (!Number.isSafeInteger(storeyCount) || storeyCount < 1)
		throw new RangeError('A cell space needs at least one storey');
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
	let offset = 0;
	const elevations = [baseZ];
	for (const [index, height] of heights.entries()) {
		offset = uniform === undefined ? offset + height : (index + 1) * uniform;
		const top = baseZ + offset;
		if (!Number.isFinite(top) || top <= elevations[index])
			throw new RangeError('Storey boundaries must increase at the given datum');
		elevations.push(top);
	}
	return Object.freeze({
		baseZ,
		storeyCount,
		storeyHeightM: uniform,
		storeyHeightsM: Object.freeze(heights),
		storeyElevationsM: Object.freeze(elevations)
	});
}

/** Absolute elevation of a storey boundary, including the roof above the last storey. */
export function readStoreyElevation(space: StoreyStack, index: number): number {
	requireIndex(index, space.storeyCount + 1);
	return space.storeyHeightM === undefined
		? space.storeyElevationsM[index] + (space.baseZ - space.storeyElevationsM[0])
		: space.baseZ + index * space.storeyHeightM;
}

/** Recipe height of a storey, indexed from zero. */
export function readStoreyHeight(space: StoreyStack, index: number): number {
	requireIndex(index, space.storeyCount);
	return space.storeyHeightM ?? space.storeyHeightsM[index];
}

/** Stable address of a storey in one fine cell. */
export function readStoreyRef(spaceId: string, cellId: string, storey: number, world = worldScope) {
	requireIndex(storey);
	return createWorldReference(world, 'storey', encodeKey([spaceId, cellId, storey]));
}

/** Storeys in cell order, then from bottom to top, with optional world scope. */
export function readCellStoreys(space: CellSpace, world = worldScope) {
	return Object.freeze(
		space.cells.flatMap(({ id: cellId }) =>
			Array.from({ length: space.storeyCount }, (_, storey) =>
				Object.freeze({
					ref: readStoreyRef(space.id, cellId, storey, world),
					cellId,
					storey,
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
	space: Pick<CellSpace, 'id' | 'kind' | 'cells'>,
	sizing: StoreySizing
): CellSpace {
	const { id, kind, cells } = space;
	let storeys: CellSpace['storeys'] | undefined;
	const result: CellSpace = Object.freeze({
		id,
		...(kind ? { kind } : {}),
		...createStoreyStack(sizing),
		cells,
		get storeys() {
			return (storeys ??= readCellStoreys(result));
		}
	});
	return result;
}
