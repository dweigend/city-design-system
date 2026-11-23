import { required } from '../../core/invariant';
import { blockInputs, defineParams, resolveParams } from '../../core/params';
import type { PlanVariant, TerrainGrid } from '../terrain-grid';
import { seedDistricts, type DistrictCell } from './districts';
import type { CityCore } from './rank';
import { levelHeight } from './settlement';
import {
	createFrame,
	latticeVariants,
	type CityLattice,
	type Column,
	type LatticeVariant
} from './frame';

/** Level height, settlement thresholds, fixed district levels, neighbor step limit and the
 * peak law, with their units and reasons. */
export {
	districtLevels,
	levelHeight,
	maximumLevelStep,
	peakLaw,
	settlementThresholds
} from './settlement';

/** Village, town or city, decided by built-up area. */
export type { SettlementKind } from './settlement';

/** Core frame of the district ranking in world meters and radians, with the short-to-long
 * axis ratio of the city. */
export type { CityCore } from './rank';

/** Height caps the peak above the site datum in meters; the city's area sets what the peak can
 * reach below that cap. Complexity is unitless district fragmentation. */
export const cityVolumeParams = defineParams({
	height: { label: 'Height', unit: 'm', min: 21, max: 140, default: 140, step: levelHeight },
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

/** Derives the city height profile of one plan from its built-up area, a uint32 seed and the
 * core frame. A village below 1 km² holds detached houses only, a town adds six-storey
 * blocks, a city from 3 km² adds a high-rise center whose peak grows with the area. Cells are
 * ranked outward from the core by a seeded, extent-independent rank and filled by area share,
 * so a larger crop only converts cells upward. Center columns fall from the peak to the block
 * podium, and no column stands more than three levels above a neighbor. peakHeight is the
 * realized peak above the datum in meters. */
export function createCityDistricts(
	plan: TerrainGrid,
	core: CityCore,
	seed: number,
	parameters?: Readonly<{ height?: number; complexity?: number }>
) {
	const { height, complexity } = resolveParams(cityVolumeParams, parameters);
	const profile = seedDistricts(plan, core, seed, complexity, height / levelHeight);
	return Object.freeze({
		settlement: profile.settlement,
		areaKm2: profile.areaKm2,
		/** Plan area share of each district kind, summing to 1. */
		shares: profile.shares,
		peakHeight: profile.peakLevels * levelHeight,
		/** Reads the frozen district assignment of a plan cell. Unknown cells throw. */
		cell(id: string): DistrictCell {
			return required(profile.cells.get(id), 'district cell');
		}
	});
}

/** Immutable district assignment of one plan. */
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
