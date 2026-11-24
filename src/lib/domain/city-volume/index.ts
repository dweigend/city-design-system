/** Module: Ranks plan cells, sets district heights and builds structural lattices. */
import { required } from '../../core/invariant';
import { createBlockInputs, defineParams, resolveParams } from '../../core/params';
import {
	cityVolumeConfig as coarseSettings,
	cityVolumeInputs as inputs
} from '../../../config/city-volume';
import { defaultStoreyHeightM } from '../cell-space';
import type { TerrainGrid } from '../terrain-grid';
import { columnPlanes, levelHeight, requireLevelSpacing } from './foundation';
import { createStructuralColumns, validateColumns, type StructuralColumn } from './columns';
import { seedDistricts, type DistrictCell, type DistrictGrowth } from './districts';
import type { CityCore } from './rank';
import { districtLevels, peakLaw } from './settlement';
import type { CityLattice } from './frame';
import { createLattice, type LatticeVariant } from './lattices';

/** Coarse level, density and foundation settings. */
export const cityVolumeConfig = Object.freeze({
	storeyHeightM: defaultStoreyHeightM,
	...coarseSettings
});

/** Ranks dry ground by distance, corridors, grade and water clearance. */
export { cityAccessibility, type CityApproachPolicy } from './accessibility';
/** Column roof elevation, default level spacing and storeys per structural level. */
export { columnRoof, levelHeight, storeysPerLevel } from './foundation';
/** Produces a nested city footprint from the accessibility of plan cells. */
export { cityGrowth, cityGrowthDefaults, type CityGrowthPolicy } from './footprint';

/** Settlement thresholds, fixed district levels, neighbor step limit and the
 * peak law, with their units and reasons. */
export { districtLevels, maximumLevelStep, peakLaw, settlementThresholds } from './settlement';

/** Village, town or city, decided by built-up area. */
export type { SettlementKind } from './settlement';

/** Core frame of the district ranking in world meters and radians, with the short-to-long
 * axis ratio of the city. */
export type { CityCore } from './rank';

/** Height caps the peak above the site datum in meters; the city's area sets what the peak can
 * reach below that cap. Complexity is unitless district fragmentation. Taper is the signed share
 * of the taper field a far view applies: 1 retreats, 0 keeps the columns upright, −1 overhangs. */
export const cityVolumeParams = defineParams({
	height: {
		label: 'Height',
		unit: 'm',
		min: districtLevels.block * levelHeight,
		max: peakLaw.fullLevels * levelHeight,
		default: peakLaw.fullLevels * levelHeight,
		step: levelHeight
	},
	complexity: { ...createBlockInputs().complexity, default: inputs.districtComplexityDefaultRatio },
	taper: {
		label: 'Taper',
		unit: '',
		min: -inputs.cityTaperLimitRatio,
		max: inputs.cityTaperLimitRatio,
		default: inputs.cityTaperDefaultRatio,
		step: inputs.cityTaperStepRatio
	}
});

/** Signed volume in m³ of every solid of a lattice, in solid order. Unknown joints throw. */
export { latticeVolumes } from './lattices';

/** Lattices whose solids are the bays themselves, so every bay side face is framed by members.
 * The other models keep the bays as addresses and build their own solids. */
export { prismVariants } from './frame';

/** Horizontal meters a tapered corner moves per level above its lowest neighbor. */
export { taperStep } from './taper';
/** The continuous retreat or overhang of the city volume, read at any plan address and height. */
export { createCityTaper, type CityTaper } from './taper';

/** One closed volume cell of a lattice, owned by one bay, with faces wound outward. */
export { solidEdgeFaults, type LatticeSolid } from './solid';

/** All structural lattice models, in display order. */
export { latticeVariants } from './lattices';

/** Stable district identity, current density region and height of a plan cell, and the ranked growth data. */
export type { DistrictKind, DistrictCell, DistrictGrowth } from './districts';

/** Canonical bay, face, and corner addresses. */
export type { LatticeBay, BayFace, LatticePoint } from './bay-addresses';
/** Logical child cell, face, and edge addresses for a bisected bay. */
export { subdivideBay, type ChildBay, type ChildBayFace } from './subdivision';

/** Lattice model name, and the resulting canonical bays, faces, joints, members and solids. */
export type { LatticeVariant, CityLattice };

/** One column per plan cell, carrying district identity and terrain corners in world meters. */
export type CityColumn = StructuralColumn & DistrictCell;

/** Validates and detaches columns from caller-owned topology. */
export { createStructuralColumns, type StructuralColumn } from './columns';

function requireBuildableGrid(plan: TerrainGrid) {
	if (plan.cells.some(({ groundKind }) => groundKind !== undefined && groundKind !== 'dry'))
		throw new RangeError('Expected the clipped buildable grid');
}

/** Derives the city height profile of one plan from its built-up area, a uint32 seed and the
 * core frame. A village below 1 km² holds detached houses only, a town adds six-storey
 * blocks, a city from 3 km² adds a high-rise center whose peak grows with the area. Cells are
 * ranked outward from the core and filled by area share. A supplied fixed growth order and
 * its future fringe keep earlier cells from moving down. Edge-connected occupied cells keep the
 * earliest founder's address across growth. Density regions group connected cells of one kind.
 * Center columns fall from the peak to the block
 * podium, and no column stands more than three levels above a neighbor. peakHeight is the
 * realized nominal height in meters, measured in whole levels. A grid containing water throws. */
export function createCityDistricts(
	plan: TerrainGrid,
	core: CityCore,
	seed: number,
	parameters?: Readonly<{ height?: number; complexity?: number }>,
	growth?: DistrictGrowth
) {
	requireBuildableGrid(plan);
	const { height, complexity } = resolveParams(cityVolumeParams, parameters);
	const profile = seedDistricts(plan, core, seed, complexity, height / levelHeight, growth);
	return Object.freeze({
		settlement: profile.settlement,
		areaKm2: profile.areaKm2,
		/** Area share of each kind, summing to 1 for a settled plan. An empty plan has all-zero shares. */
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

type ColumnAssignment = Pick<DistrictCell, 'levels' | 'kind'> & Partial<DistrictCell>;
type AssignmentReader<A> = ((id: string) => A) | Readonly<{ cell(id: string): A }>;

/** Returns immutable columns in buildable grid order using the caller's cell assignments.
 * A district profile can supply the assignments through its cell reader. A grid containing
 * water throws. Each column retains the sampled terrain corners and hub elevation. */
export function readCityColumns(
	plan: TerrainGrid,
	assignment: AssignmentReader<DistrictCell>,
	maxLevels?: number
): readonly CityColumn[];
export function readCityColumns(
	plan: TerrainGrid,
	assignment: AssignmentReader<ColumnAssignment>,
	maxLevels?: number
): readonly (StructuralColumn & ColumnAssignment)[];
export function readCityColumns(
	plan: TerrainGrid,
	assignment: AssignmentReader<ColumnAssignment>,
	maxLevels?: number
): readonly (StructuralColumn & ColumnAssignment)[] {
	requireBuildableGrid(plan);
	const vertices = new Map(plan.vertices.map((vertex) => [vertex.id, vertex]));
	return createStructuralColumns(
		plan.cells.map(({ id, vertexIds, neighbors, centerHeight }) => {
			const { districtId, densityRegionId, kind, levels } =
				typeof assignment === 'function' ? assignment(id) : assignment.cell(id);
			return {
				planCellId: id,
				corners: vertexIds.map((key) => required(vertices.get(key), 'plan corner')),
				neighbors,
				groundAtHub: centerHeight,
				...(districtId === undefined ? {} : { districtId }),
				...(densityRegionId === undefined ? {} : { densityRegionId }),
				kind,
				levels
			};
		}),
		maxLevels
	);
}

/** Builds a frame from structural columns in plan order. Its base follows the terrain and
 * upper planes use the supplied spacing above datumZ, in meters. The level cap counts levels
 * above each foundation. Shared faces, joints and members are emitted once. */
export function createCityLattice(
	columns: readonly StructuralColumn[],
	datumZ: number,
	variant: LatticeVariant = 'box',
	{
		levelHeightM = levelHeight,
		maxLevels = coarseSettings.maximumColumnLevels
	}: Readonly<{
		levelHeightM?: number;
		maxLevels?: number;
	}> = {}
): CityLattice {
	if (!Number.isFinite(datumZ)) throw new RangeError('Expected a finite city datum');
	requireLevelSpacing(levelHeightM);
	validateColumns(columns, maxLevels);
	for (const column of columns) columnPlanes(column, datumZ, levelHeightM);
	return createLattice(columns, datumZ, variant, levelHeightM);
}

/** Reads or builds one addressed bay using its canonical solid faces and members. */
export { createLatticeBayObject, readLatticeBay } from './bay-object';
