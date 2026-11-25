/** Module: Builds city growth selections on a valley or caller-supplied terrain. */
import { createDeriveCache } from '../../core/derive';
import type { Key } from '../../core/ref';
import type { Vec2 } from '../../core/geometry';
import { laneSettings } from '../../../config/lanes';
import { defineParams, resolveParams } from '../../core/params';
import { Random, uint32Limit } from '../../core/random';
import { createCityDistricts, type DistrictGrowth } from '../../domain/city-volume';
import { TerrainGrid, type TerrainGrid as Grid } from '../../domain/terrain-grid';
import { Valley, type ValleySettings } from '../../domain/valley';
import type { CityPlanVariant } from './presets';
import { preparePlanSelection } from './plan-selection';
import { growthPrefix, prepareCarrier } from './carrier';
import { citySiteConfig, citySiteDimensions as dimensions } from '../../../config/city-site';
import type { CityTerrainSampler } from './sampling';
import type { CityCrossing } from './crossings';
import {
	resolveCityRecipe,
	riverCityRecipe,
	type CityRecipe,
	type CityRecipeInput
} from './recipe';

/** Maximum sampled height range, in meters, in a buildable city cell. */
export const maximumCellRiseM = citySiteConfig.maximumCellRiseM;
/** Minimum dry clearance required for occupied cells, in meters. */
export const cityBankSetbackM = citySiteConfig.bankSetbackM;
/** City carrier limits used by planning and its studies. */
export { citySiteConfig };
export type {
	/** Elevation and signed water clearance in meters, with water kind and surface height at wet points. */
	CityTerrainReading,
	/** Reads ground elevation, signed bank clearance and any water surface in meters. */
	CityTerrainSampler
} from './sampling';
export type {
	/** A bank-to-bank crossing addressed by an edge path, with an optional direct bridge span. */
	CityCrossing,
	/** Selects which wet ground kinds may form one continuous crossing. */
	CrossableWater
} from './crossings';
export {
	/** Resolves a uniform or mixed stack that spans a full coarse level. */
	createCityVerticalRecipe,
	/** The seeded valley favors main-river approaches and permits crossings of flowing water. */
	riverCityRecipe,
	/** Selects water, growth thresholds and vertical sizing. */
	type CityRecipe,
	/** Author-supplied overrides for the city recipe. */
	type CityRecipeInput,
	/** Resolved coarse spacing and storey sizing. */
	type CityVerticalRecipe,
	/** Vertical dimensions supplied by a recipe author. */
	type CityVerticalRecipeInput
} from './recipe';
export {
	/** Tiled plan families offered by the city chapter and the lattice models each may use. */
	cityLatticesByPlan,
	/** Chapter plan families in display order. */
	cityPlanVariants,
	/** Plan families offered by the city chapter. */
	type CityPlanVariant
} from './presets';

/** City size sets the target area in the fixed valley. The seed varies access and plan jitter. */
export const citySiteParams = defineParams({
	citySize: {
		label: 'City size',
		unit: 'm',
		default: dimensions.citySizeDefaultM,
		min: dimensions.citySizeMinimumM,
		max: dimensions.citySizeMaximumM,
		step: dimensions.citySizeStepM
	},
	seed: {
		label: 'Seed',
		unit: '',
		default: dimensions.cityDefaultSeed,
		min: /* Exact arithmetic: unsigned range starts at zero. */ 0,
		max: uint32Limit - 1,
		step: /* Exact arithmetic: adjacent integer seeds differ by one. */ 1
	}
});

/** Equivalent square side of a typical coarse plan cell, in meters. */
export const coarseCellSize = citySiteConfig.coarseCellSizeM;

function siteParams(citySize?: number, seed?: number) {
	return resolveParams(citySiteParams, {
		...(citySize === undefined ? {} : { citySize }),
		...(seed === undefined ? {} : { seed })
	});
}

/** Keep the terrain revision getter in sync with mutable samplers, including after undo.
 * Omitting the getter declares that the sampler stays immutable for the life of the site. */
export type CitySiteOptions = Readonly<{
	terrainRevision?: () => string | Key;
	recipe?: CityRecipeInput;
}>;
type Settings = Partial<ValleySettings> & Readonly<{ seed?: number }> & CitySiteOptions;
type CityFrame = Readonly<{
	origin: Vec2;
	frame: Readonly<{ bearing: number }>;
	sampleGround: CityTerrainSampler;
	terrainRevision?: CitySiteOptions['terrainRevision'];
	recipe?: CityRecipe;
}>;

/** A city site with a default valley or an alternate ground source. */
export type CitySite = CityFrame & Readonly<{ valley: Valley | null }>;

/** Creates a site on a generated valley with optional terrain settings. */
export function createCitySite(
	terrain?: undefined,
	settings?: Settings
): CityFrame & { readonly valley: Valley };
/** Creates a site using the alternate ground source for planning and projection. */
export function createCitySite(
	terrain: CityTerrainSampler,
	options?: CitySiteOptions
): CityFrame & { readonly valley: null };
export function createCitySite(terrain?: CityTerrainSampler, settings?: Settings): CitySite {
	const {
		seed = citySiteParams.seed.default,
		terrainRevision,
		recipe,
		...parameters
	} = settings ?? {};

	const frame = Object.freeze({ bearing: dimensions.citySiteBearingRad });
	const origin = Object.freeze(/* Exact arithmetic: city frame origin. */ [0, 0] as const);
	const options = {
		...(terrainRevision && { terrainRevision }),
		...(recipe && { recipe: resolveCityRecipe(recipe) })
	};
	if (terrain)
		return Object.freeze({ valley: null, frame, origin, sampleGround: terrain, ...options });
	const valley = Valley.create({ seed, parameters });
	const sampleGround: CityTerrainSampler = (x, y) => {
		const { height, bank: waterClearance, waterKind, water } = valley.sampleTerrain(x, y);
		return waterKind === null
			? { height, waterClearance, waterKind }
			: { height, waterClearance, waterKind, waterHeight: water };
	};
	return Object.freeze({ valley, frame, origin, sampleGround, ...options });
}

type Carrier = ReturnType<typeof prepareCarrier> & {
	planSelection: ReturnType<typeof preparePlanSelection>;
};
const carriers = createDeriveCache<CitySite, Carrier>(laneSettings.cityCarrierCacheLimit);

const metersPerKilometer = /* Exact arithmetic: meters per kilometer. */ 1000;
const squareMetersPerSquareKilometer = metersPerKilometer ** 2;

function targetArea(citySizeM: number) {
	const lengthKm = citySizeM / metersPerKilometer;
	return (
		squareMetersPerSquareKilometer *
		lengthKm *
		(citySiteConfig.targetAreaBaseRatio + citySiteConfig.targetAreaGrowthRatio * lengthKm)
	);
}

function carrier(city: CitySite, variant: CityPlanVariant, seed: number) {
	const revision = city.terrainRevision?.() ?? '';
	return carriers(city, [variant, seed], revision, () => {
		const station = Random.create({ seed }).derive('crossing-station').number({
			min: -citySiteConfig.centerStationRangeM,
			max: citySiteConfig.centerStationRangeM
		});
		const {
			frame: { bearing },
			sampleGround,
			origin
		} = city;
		const prepared = prepareCarrier(
			{
				origin,
				sampleGround,
				bearing,
				bankSide: city.valley ? sections(city, revision) : undefined,
				center: [origin[0] + station * Math.cos(bearing), origin[1] + station * Math.sin(bearing)]
			},
			coarseCellSize,
			variant,
			seed,
			targetArea(citySiteParams.citySize.max),
			city.recipe ?? riverCityRecipe
		);
		return { ...prepared, planSelection: preparePlanSelection(prepared.plan) };
	});
}

type TrunkSegment = readonly [x: number, y: number, dx: number, dy: number, length2: number];
const trunkSections = createDeriveCache<CitySite, (point: Vec2) => number>();
const sectionSize = dimensions.trunkSectionSizeM;

function sections(city: CitySite, revision: string | Key) {
	return trunkSections(city, ['trunk'], revision, () => indexTrunk(city.valley?.course.xy ?? []));
}

function indexTrunk(xy: ArrayLike<number>) {
	const index = new Map<number, TrunkSegment[]>();
	for (let i = 2; i < xy.length; i += 2) {
		const x = xy[i - 2];
		const y = xy[i - 1];
		const dx = xy[i] - x;
		const dy = xy[i + 1] - y;
		const length2 = dx * dx + dy * dy;
		if (!length2) continue;
		const segment: TrunkSegment = [x, y, dx, dy, length2];
		for (
			let section = Math.floor(
				(Math.min(y, y + dy) - dimensions.trunkSectionSearchM) / sectionSize
			);
			section <= Math.floor((Math.max(y, y + dy) + dimensions.trunkSectionSearchM) / sectionSize);
			section++
		) {
			const list = index.get(section) ?? [];
			list.push(segment);
			index.set(section, list);
		}
	}
	return ([x, y]: Vec2) => {
		let nearest = Infinity;
		let side = 0;
		for (const [a, b, dx, dy, length2] of index.get(Math.floor(y / sectionSize)) ?? []) {
			const u = x - a;
			const v = y - b;
			const t = Math.max(0, Math.min(1, (u * dx + v * dy) / length2));
			const distance2 = (u - t * dx) ** 2 + (v - t * dy) ** 2;
			if (distance2 >= nearest) continue;
			nearest = distance2;
			side = Math.sign(dx * v - dy * u);
		}
		return side;
	};
}

/** Reads the side of the nearest trunk segment. Positive is left looking downstream. */
export function readCitySide(city: CitySite, point: Vec2) {
	return sections(city, city.terrainRevision?.() ?? '')(point);
}

/** Frames the selected blocks on the surrounding terrain, in world XY meters and radians. */
export function cityWindow(city: CitySite, grid: Grid) {
	const { bearing } = city.frame;
	if (!grid.vertices.length)
		return {
			origin: city.origin,
			bearing,
			length: dimensions.emptyCityWindowLengthM,
			width: dimensions.emptyCityWindowWidthM
		};
	const u = Math.cos(bearing);
	const v = Math.sin(bearing);
	const [x, y] = city.origin;
	let left = Infinity,
		right = -Infinity,
		bottom = Infinity,
		top = -Infinity;
	for (const {
		position: [wx, wy]
	} of grid.vertices) {
		const a = (wx - x) * u + (wy - y) * v;
		const b = (wy - y) * u - (wx - x) * v;
		left = Math.min(left, a);
		right = Math.max(right, a);
		bottom = Math.min(bottom, b);
		top = Math.max(top, b);
	}
	const along = (left + right) / 2;
	const across = (bottom + top) / 2;
	return {
		origin: [x + along * u - across * v, y + along * v + across * u] as const,
		bearing,
		length:
			(right - left) * dimensions.cityWindowLengthScaleRatio + dimensions.cityWindowLengthPaddingM,
		width:
			(top - bottom) * dimensions.cityWindowWidthScaleRatio + dimensions.cityWindowWidthPaddingM
	};
}

/** Takes the shortest prefix of nested growth that reaches the desired area. The datum anchors
 * the common 7 m planes at or below the lowest candidate ground. It stays fixed as a city grows.
 * The grid holds setback-clipped buildable cells, the plan holds the uncut cells including
 * water inside and along the edge of the footprint. Crossings list channel candidates
 * with both heads in the built footprint. The default selection takes up to one candidate
 * plus one per started 1.25 km² of built area, in candidate order. */
export function readCityGrid(
	city: CitySite,
	citySize: number,
	variant: CityPlanVariant = 'organic',
	seed?: number
) {
	const params = siteParams(citySize, seed);
	const { candidates, plan, planSelection, crossings, order, ranks, datumZ } = carrier(
		city,
		variant,
		params.seed
	);
	const selected = growthPrefix(order, targetArea(params.citySize));
	const ids = selected.map(({ id }) => id);
	const grid = TerrainGrid.select(candidates, ids);
	const built = new Set(ids);
	const activeCrossings: CityCrossing[] = [];
	const planIds = planSelection(grid);
	for (const {
		id,
		path,
		span,
		heads: [first, second],
		waterCellIds
	} of crossings) {
		const from = first.cellIds.filter((id) => built.has(id));
		const to = second.cellIds.filter((id) => built.has(id));
		if (!from.length || !to.length) continue;
		activeCrossings.push(
			Object.freeze({
				id,
				path,
				...(span ? { span } : {}),
				heads: Object.freeze([
					Object.freeze({ nodeId: first.nodeId, cellIds: Object.freeze(from) }),
					Object.freeze({ nodeId: second.nodeId, cellIds: Object.freeze(to) })
				] as const)
			})
		);
		for (const id of waterCellIds) planIds.add(id);
	}
	const futureFringe = candidates.cells
		.filter(
			({ id, neighbors }) =>
				built.has(id) &&
				neighbors.some(
					(neighbor) => neighbor !== null && (ranks.get(neighbor) ?? -1) >= selected.length
				)
		)
		.map(({ id }) => id);
	const growth: DistrictGrowth = Object.freeze({
		planScope: plan.identity.scope,
		rankedCellIds: Object.freeze(ids),
		futureFringe: Object.freeze(futureFringe)
	});
	const areas = selected
		.map(({ builtArea }, i) => builtArea - (selected[i - 1]?.builtArea ?? 0))
		.sort((a, b) => a - b);
	const middle = Math.floor(areas.length / 2);
	const areaKm2 = (selected.at(-1)?.builtArea ?? 0) / squareMetersPerSquareKilometer;
	return Object.freeze({
		grid,
		growth,
		variant,
		seed: params.seed,
		citySize: params.citySize,
		candidateCellCount: candidates.cells.length,
		plan: TerrainGrid.select(plan, [...planIds]),
		crossings: Object.freeze(activeCrossings),
		selectedCrossings: Object.freeze(
			activeCrossings.slice(
				0,
				citySiteConfig.selectionBaseCount +
					Math.ceil(areaKm2 / citySiteConfig.selectionIncrementKm2)
			)
		),
		datumZ,
		areaKm2,
		medianCellSize: areas.length
			? Math.sqrt((areas[middle] + areas[Math.floor((areas.length - 1) / 2)]) / 2)
			: 0
	});
}

/** Detached grid, selected crossings, datum and serializable growth metadata. */
export type CityGrid = ReturnType<typeof readCityGrid>;

/** Reads the addressed pedestrian network and planned holdings for a city growth selection.
 * Main lane paths describe the fixed full guides. The lane intervals and blocks are active. */
export function readCityParcels(
	city: CitySite,
	layout: Pick<CityGrid, 'growth' | 'seed' | 'variant'> & Partial<Pick<CityGrid, 'plan' | 'grid'>>
) {
	const { parcels, mainLanes, plan } = carrier(city, layout.variant, layout.seed);
	if (layout.growth.planScope !== plan.identity.scope)
		throw new RangeError('City growth belongs to a different plan');
	for (const grid of [layout.plan, layout.grid]) {
		if (
			grid &&
			(grid.identity?.scope !== plan.identity.scope || grid.identity.variant !== layout.variant)
		)
			throw new RangeError('City layout belongs to a different plan');
	}
	return Object.freeze({ ...parcels.read(layout.growth.rankedCellIds), mainLanes });
}

/** Derives districts from the same fixed accessibility order as the footprint. */
export function readCityDistricts(
	city: CitySite,
	{ grid, growth }: Pick<CityGrid, 'grid' | 'growth'>,
	seed?: number,
	parameters?: Parameters<typeof createCityDistricts>[3]
) {
	const params = siteParams(undefined, seed);
	const core = /* Exact arithmetic: unit aspect keeps the initial plan round. */ {
		origin: city.origin,
		bearing: city.frame.bearing,
		aspect: 1
	};
	return createCityDistricts(
		grid,
		core,
		params.seed,
		parameters,
		growth,
		(city.recipe ?? riverCityRecipe).levelHeightM
	);
}

/** Samples the mesh geometry for an alternate terrain source in the city window. */
export { sampleCityWindow } from './sample-window';
