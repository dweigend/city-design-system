import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { blockInputs, defineParams, resolveParams } from '../../core/params';
import type { PlanVariant, TerrainGrid } from '../terrain-grid';
import { seedDistricts, type DistrictCell } from './districts';
import {
	createFrame,
	latticeVariants,
	type CityLattice,
	type Column,
	type LatticeVariant
} from './frame';

/** One coarse level covers two 3.5 m storeys. Upper level planes are 7 m apart. */
export const levelHeight = 7;

/** City peak above the site datum in meters and unitless district fragmentation. */
export const cityVolumeParams = defineParams({
	height: { label: 'Height', unit: 'm', min: 35, max: 140, default: 105, step: levelHeight },
	complexity: { ...blockInputs.complexity, default: 0.35 }
});

/** Compatible carriers by tiled plan family. All four share the same polygon side faces.
 * Polar and free-quad are excluded from the chapter because its terrain mask can open holes. */
export const cityLatticesByPlan = Object.freeze({
	organic: latticeVariants,
	square: latticeVariants,
	hex: latticeVariants,
	triangle: latticeVariants,
	bands: latticeVariants,
	contour: latticeVariants,
	voronoi: latticeVariants
} satisfies Partial<Record<PlanVariant, readonly LatticeVariant[]>>);

/** Chapter plan families with a compatible carrier. */
export type CityPlanVariant = keyof typeof cityLatticesByPlan;

/** Chapter plan families in display order. */
export const cityPlanVariants = Object.freeze(Object.keys(cityLatticesByPlan) as CityPlanVariant[]);

/** One connected district's kind and the assigned height of this addressed plan cell. */
export type { DistrictKind, DistrictCell } from './districts';

/** Member topology applied to each bay and the resulting canonical faces, joints and members. */
export type { LatticeVariant, CityLattice };

/** One column per plan cell, carrying district identity and terrain corners in world meters. */
export type CityColumn = Column & DistrictCell;

const detached = Object.freeze({ districtId: 'detached/0', kind: 'detached', levels: 1 } as const);

/** Seeds the core and block districts on the fixed, connected initial city plan. The initial
 * belt retains every boundary cell so later growth joins it. Origin is world XY in meters.
 * The initial plan needs enough interior cells to seed the requested districts. */
export function createCityDistricts(
	initial: TerrainGrid,
	origin: Vec2,
	seed: number,
	parameters?: Readonly<{ height?: number; complexity?: number }>
) {
	const { height, complexity } = resolveParams(cityVolumeParams, parameters);
	const cells = seedDistricts(initial, origin, seed, complexity, height / levelHeight);
	return Object.freeze({
		peakHeight: height,
		/** Reads the frozen district assignment of a cell in the initial or a larger crop. */
		cell(id: string): DistrictCell {
			return cells.get(id) ?? detached;
		}
	});
}

/** Immutable district assignments for a nested sequence of plan crops. */
export type CityDistricts = ReturnType<typeof createCityDistricts>;

/** Returns immutable columns in plan order. Each column starts at the plan's terrain corners. */
export function readCityColumns(
	plan: TerrainGrid,
	districts: CityDistricts
): readonly CityColumn[] {
	const vertices = new Map(plan.vertices.map((vertex) => [vertex.id, vertex]));
	return Object.freeze(
		plan.cells.map(({ id, vertexIds, neighbors }) =>
			Object.freeze({
				planCellId: id,
				corners: Object.freeze(vertexIds.map((key) => required(vertices.get(key), 'plan corner'))),
				neighbors,
				...districts.cell(id)
			})
		)
	);
}

/** Builds a compatible frame. The base follows the terrain and higher planes are all measured
 * from datumZ in world meters. The first plane must be above all terrain corners. Shared
 * faces, joints and members are emitted once. Unknown or incompatible variants throw. */
export function createCityLattice(
	columns: readonly CityColumn[],
	datumZ: number,
	plan: CityPlanVariant,
	variant: LatticeVariant = 'box'
): CityLattice {
	if (!Object.hasOwn(cityLatticesByPlan, plan) || !cityLatticesByPlan[plan].includes(variant))
		throw new RangeError('Incompatible plan and lattice');
	if (
		!Number.isFinite(datumZ) ||
		columns.some(({ corners }) =>
			corners.some(({ position }) => position[2] >= datumZ + levelHeight)
		)
	)
		throw new RangeError('The first city level plane must clear the terrain');
	return createFrame(columns, datumZ, levelHeight, variant);
}
