import { crossProduct, displacement, dotProduct, type Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { createWorldReference, encodeKey, type Ref } from '../../core/ref';
import { createCellSpace, readCellStoreys } from '../../domain/cell-space';
import { readLatticeBay, type CityLattice } from '../../domain/city-volume';
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

type Plane = Readonly<{ origin: Vec3; normal: Vec3 }>;

function solidPlanes({ solidTriangles }: ReturnType<typeof readLatticeBay>) {
	return solidTriangles.map((triangles) =>
		triangles.map(([a, b, c]) => {
			const origin = a.position;
			return {
				origin,
				normal: crossProduct(displacement(origin, b.position), displacement(origin, c.position))
			};
		})
	);
}

/** Intersection of inward half-spaces stays inside the model solid, including faceted bays. */
function inside(points: readonly Corner[], planes: readonly Plane[]) {
	return planes.every(({ origin, normal }) =>
		points.every(({ position }) => {
			const delta = displacement(origin, position);
			const tolerance =
				/* Exact arithmetic: accumulated roundoff from subtraction, cross and dot. */ 16 *
				Number.EPSILON *
				Math.hypot(...normal) *
				Math.max(Math.hypot(...origin), Math.hypot(...position));
			return dotProduct(normal, delta) <= tolerance;
		})
	);
}

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
 * The recipe uses the lattice datum and coarse spacing. A prism that crosses the ground cap,
 * a model boundary or an internal model solid seam is omitted. */
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
	const { bay, floor, ceiling } = geometry;
	const minimumZ = Math.max(...floor.map(({ position }) => position[2]));
	const maximumZ = Math.min(...ceiling.map(({ position }) => position[2]));
	if (maximumZ <= minimumZ) return Object.freeze([]);
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
	const solids = solidPlanes(geometry);
	return Object.freeze(
		readCellStoreys(space, world).flatMap((storey) => {
			const { bottomZ, topZ, cellId, datumIndex, key } = storey;
			if (bottomZ < minimumZ || topZ > maximumZ) return [];
			const { quad, cornerIds } = required(cells.get(cellId), 'fine plan cell');
			const ring = (z: number, datum: number) =>
				quad.map(([x, y], i): Corner =>
					Object.freeze({
						id: encodeKey([cornerIds[i], datum]),
						position: Object.freeze([x, y, z] as const)
					})
				);
			const lower = ring(bottomZ, datumIndex);
			const upper = ring(topZ, datumIndex + 1);
			const corners = [...lower, ...upper];
			if (!solids.some((planes) => inside(corners, planes))) return [];
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
