import { distance, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { defaultStoreyHeightM } from '../../domain/cell-space';
import { Random } from '../../core/random';
import {
	cityGrowthDefaults,
	levelHeight,
	storeysPerLevel,
	type CityApproachPolicy,
	type CityGrowthPolicy
} from '../../domain/city-volume';
import type { TerrainGrid } from '../../domain/terrain-grid';
import { citySiteConfig as config } from '../../../config/city-site';
import { channelCrossings, type CrossableWater } from './crossings';
import type { CityTerrainSampler } from './sampling';

export type CarrierSite = Readonly<{
	sampleGround: CityTerrainSampler;
	origin: Vec2;
	bearing: number;
	center: Vec2;
	bankSide?: (point: Vec2) => number;
}>;

/** Sizes the coarse level and its ordered storeys. A mixed stack repeats at each coarse plane.
 * `storeyHeightM` gives the uniform height when there is no explicit stack. */
export type CityVerticalRecipe = Readonly<{
	levelHeightM: number;
	storeysPerLevel: number;
	storeyHeightM: number;
	storeyHeightsM?: readonly number[];
}>;

/** Selects water, growth thresholds and vertical sizing. */
export type CityRecipe = CityVerticalRecipe &
	Readonly<{
		isCrossable: CrossableWater;
		isPrimaryWater: CrossableWater;
		approach?: CityApproachPolicy;
		minimumRegionAreaM2: number;
		growth: CityGrowthPolicy;
	}>;

/** The seeded valley favors main-river approaches and permits crossings of flowing water. */
export const riverCityRecipe = Object.freeze<CityRecipe>({
	isCrossable: (kind) => kind === 'river' || kind === 'tributary',
	isPrimaryWater: (kind) => kind === 'river',
	minimumRegionAreaM2: config.minimumRegionAreaM2,
	growth: cityGrowthDefaults,
	levelHeightM: levelHeight,
	storeyHeightM: defaultStoreyHeightM,
	storeysPerLevel
});

function readStoreysPerLevel(recipe: Partial<CityVerticalRecipe>): number {
	const { storeyHeightsM } = recipe;
	const count = recipe.storeysPerLevel ?? storeyHeightsM?.length ?? riverCityRecipe.storeysPerLevel;
	if (
		!Number.isSafeInteger(count) ||
		count < 1 ||
		(storeyHeightsM && storeyHeightsM.length !== count)
	)
		throw new RangeError('Expected one height per storey of a coarse level');
	return count;
}

const isPositiveLength = (height: number) => Number.isFinite(height) && height > 0;

function readLevelSpan(heights: readonly number[]): number {
	if (!heights.every(isPositiveLength))
		throw new RangeError('Storey heights must be positive finite lengths');
	return heights.reduce((total, height) => total + height, 0);
}

/** Resolves a uniform or mixed stack that spans a full coarse level. */
export function createCityVerticalRecipe(
	recipe: Partial<CityVerticalRecipe> = {}
): CityVerticalRecipe {
	const storeysPerLevel = readStoreysPerLevel(recipe);
	const storeyHeightsM = recipe.storeyHeightsM && Object.freeze([...recipe.storeyHeightsM]);
	const mixedSpan = storeyHeightsM && readLevelSpan(storeyHeightsM);
	const uniformSpan =
		recipe.storeyHeightM === undefined ? undefined : recipe.storeyHeightM * storeysPerLevel;
	const levelHeightM =
		recipe.levelHeightM ?? mixedSpan ?? uniformSpan ?? riverCityRecipe.levelHeightM;
	const storeyHeightM = recipe.storeyHeightM ?? levelHeightM / storeysPerLevel;
	if (!isPositiveLength(levelHeightM) || !isPositiveLength(storeyHeightM))
		throw new RangeError('City level and storey heights must be positive finite lengths');
	const span = mixedSpan ?? uniformSpan ?? levelHeightM;
	// Exact arithmetic: allow one rounding unit per summed height.
	if (Math.abs(span / levelHeightM - 1) > Number.EPSILON * storeysPerLevel)
		throw new RangeError('The storeys must span one coarse level');
	return Object.freeze({
		levelHeightM,
		storeysPerLevel,
		storeyHeightM,
		...(storeyHeightsM && { storeyHeightsM })
	});
}

export function resolveCityRecipe(recipe: Partial<CityRecipe>): CityRecipe {
	return Object.freeze({
		isCrossable: recipe.isCrossable ?? riverCityRecipe.isCrossable,
		isPrimaryWater: recipe.isPrimaryWater ?? recipe.isCrossable ?? riverCityRecipe.isPrimaryWater,
		minimumRegionAreaM2: recipe.minimumRegionAreaM2 ?? riverCityRecipe.minimumRegionAreaM2,
		growth: recipe.growth ? Object.freeze({ ...recipe.growth }) : riverCityRecipe.growth,
		approach: recipe.approach && Object.freeze({ ...recipe.approach }),
		...createCityVerticalRecipe(recipe)
	});
}

// Look for a narrow cross section near the seeded station. Water widths are measured
// from the same terrain readings used for the plan, at regular intervals across the belt.
function crossingCenter(
	center: Vec2,
	u: number,
	v: number,
	sample: CityTerrainSampler,
	isPrimaryWater: CrossableWater,
	isCrossable: CrossableWater
) {
	let best: Vec2 | undefined;
	let bestCost = Infinity;
	for (
		let along = -config.centerSearchAlongM;
		along <= config.centerSearchAlongM;
		along += config.centerSearchAlongStepM
	) {
		const x = center[0] + along * u;
		const y = center[1] + along * v;
		let entrance: number | undefined;
		for (
			let across = -config.centerSearchAcrossM;
			across <= config.centerSearchAcrossM;
			across += config.centerSearchAcrossStepM
		) {
			const kind = sample(x - across * v, y + across * u).waterKind;
			if (kind !== null && isPrimaryWater(kind)) {
				entrance ??= across - config.centerSearchAcrossStepM / 2;
				continue;
			}
			if (entrance === undefined) continue;
			const width = across - config.centerSearchAcrossStepM / 2 - entrance;
			const midpoint = entrance + width / 2;
			const cost =
				config.centerWidthWeightRatio * width +
				Math.abs(along) +
				config.centerAcrossWeightRatio * Math.abs(midpoint);
			if ((kind === null || isCrossable(kind)) && cost < bestCost) {
				bestCost = cost;
				best = [x - midpoint * v, y + midpoint * u];
			}
			entrance = undefined;
		}
	}
	return best;
}

/** Finds a stable center and ranks the primary pair of approaches before routing dry arms. */
export function crossingApproaches(
	{ sampleGround, center, bearing, bankSide: side }: CarrierSite,
	plan: TerrainGrid,
	candidates: TerrainGrid,
	seed: number,
	recipe: CityRecipe
) {
	const u = Math.cos(bearing);
	const v = Math.sin(bearing);
	const random = Random.create({ seed }).derive('crossing');
	const shift = random.number({
		min: -config.centerFallbackShiftM,
		max: config.centerFallbackShiftM
	});
	const crossing = crossingCenter(
		center,
		u,
		v,
		sampleGround,
		recipe.isPrimaryWater,
		recipe.isCrossable
	);
	const core: Vec2 = crossing ?? [center[0] - shift * v, center[1] + shift * u];
	const crossings = channelCrossings(plan, candidates, sampleGround, core, recipe.isCrossable);
	const nodes = new Map(plan.vertices.map(({ id, position: [x, y] }) => [id, [x, y] as Vec2]));
	const primary = crossings
		.filter(({ midpoint, heads: [a, b] }) => {
			const kind = sampleGround(...midpoint).waterKind;
			return (
				kind !== null &&
				recipe.isPrimaryWater(kind) &&
				(!side ||
					side(required(nodes.get(a.nodeId), 'first bank node')) !==
						side(required(nodes.get(b.nodeId), 'second bank node')))
			);
		})
		.sort(
			(a, b) =>
				distance(core, a.midpoint) +
				config.primaryPathWeightRatio * a.path.lengthM -
				distance(core, b.midpoint) -
				config.primaryPathWeightRatio * b.path.lengthM
		)[0];
	const approaches = primary?.heads
		.map(({ nodeId }) => ({ nodeId, point: required(nodes.get(nodeId), 'approach node') }))
		.sort(({ point: a }, { point: b }) => (side ? side(a) - side(b) : a[0] - b[0]));
	const first = approaches?.[0].point ?? core;
	const second = approaches?.[1].point;
	const secondSide = second && side?.(second);
	const secondBank = (point: Vec2) => {
		if (!second) return false;
		return secondSide && side
			? side(point) === secondSide
			: distance(point, second) < distance(point, first);
	};
	return { crossings, primary, approaches, heads: [first, second] as const, secondBank };
}
