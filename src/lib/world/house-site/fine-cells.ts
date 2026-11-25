import type { Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { createWorldReference, encodeKey, type Ref } from '../../core/ref';
import { createCellSpace, readCellStoreys } from '../../domain/cell-space';
import { readBayFill, readLatticeBay, type CityLattice } from '../../domain/city-volume';
import { createCityVerticalRecipe, type CityVerticalRecipeInput } from '../city-site';
import { createParcelStoreySizing } from './vertical';

type Corner = Readonly<{ id: string; position: Vec3 }>;
type Face = Readonly<{ id: string; corners: readonly Corner[] }>;

export type BayFineCell = Readonly<{
	ref: Ref<'fine-cell'>;
	storey: ReturnType<typeof readCellStoreys>[number];
	bayId: string;
	quad: ReturnType<typeof createCellSpace>['cells'][number]['quad'];
	faces: readonly Face[];
}>;

function face(corners: Corner[]): Face {
	return Object.freeze({
		id: encodeKey(corners.map(({ id }) => id).sort()),
		corners: Object.freeze(corners)
	});
}

function prismFaces(lower: Corner[], upper: Corner[]) {
	return Object.freeze([
		face([...lower].reverse()),
		face(upper),
		...lower.map((from, i) => {
			const next = (i + 1) % lower.length;
			return face([from, lower[next], upper[next], upper[i]]);
		})
	]);
}

/** Reads closed GRID-1 corner quads extruded over complete recipe storeys of a canonical bay.
 * The recipe uses the lattice datum and coarse spacing. Every emitted prism clears the local
 * caps and is covered by the combined model fill. */
export function readFineCells(
	lattice: CityLattice,
	bayId: string,
	world: string,
	recipe?: CityVerticalRecipeInput
): readonly BayFineCell[] {
	const { datumZ, levelHeightM } = lattice;
	if (recipe?.levelHeightM !== undefined && recipe.levelHeightM !== levelHeightM)
		throw new RangeError('Fine storeys and coarse bays must use the same level spacing');
	const vertical = createCityVerticalRecipe({ ...recipe, levelHeightM });
	const heights =
		vertical.storeyHeightsM ?? Array<number>(vertical.storeysPerLevel).fill(vertical.storeyHeightM);
	const geometry = readLatticeBay(lattice, bayId);
	const { bay, floor } = geometry;
	const sizing = createParcelStoreySizing(
		{ levelHeightM, storeysPerLevel: vertical.storeysPerLevel, storeyHeightsM: heights },
		datumZ,
		bay.level,
		bay.level + 1
	);
	const space = createCellSpace(
		{
			id: bay.planCellId,
			corners: floor.map(({ position: [x, y] }, i) => ({
				id: bay.planCorners[i],
				position: [x, y]
			})),
			frontage: [],
			...sizing
		},
		/* Exact arithmetic: the canonical corner split alone gives one kite per corner. */ 0
	);
	const cells = new Map(space.cells.map((cell) => [cell.id, cell]));
	const contains = readBayFill(lattice, bayId);
	return Object.freeze(
		readCellStoreys(space, world).flatMap((storey) => {
			const { bottomZ, topZ, cellId, datumIndex, key } = storey;
			const { quad, cornerIds } = required(cells.get(cellId), 'fine plan cell');
			if (!contains(quad, bottomZ, topZ)) return [];
			const ring = (z: number, datum: number) =>
				quad.map(([x, y], i): Corner =>
					Object.freeze({
						id: encodeKey([cornerIds[i], datum]),
						position: Object.freeze([x, y, z] as const)
					})
				);
			const lower = ring(bottomZ, datumIndex);
			const upper = ring(topZ, datumIndex + 1);
			return [
				Object.freeze({
					ref: createWorldReference(world, 'fine-cell', key),
					storey,
					bayId,
					quad,
					faces: prismFaces(lower, upper)
				})
			];
		})
	);
}
