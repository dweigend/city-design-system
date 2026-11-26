import { uint32Limit } from '../../lib/core/random';
import {
	advanceCityGrowth,
	createCityGrowth,
	createSandboxHandover,
	defaultCityGrowthRecipe,
	readCitySnapshot,
	type CityGrowthRecipe,
	type CityGrowthRun
} from '../../lib/world/city-growth';
import { createCitySite, type CityPlanVariant } from '../../lib/world/city-site';

export const milestones = [
	{ year: 1955, label: 'First settlement' },
	{ year: 1985, label: 'Crossing and expansion' },
	{ year: 2012, label: 'Riverside infill' },
	{ year: 2030, label: 'Handover' }
] as const;

export const foundingYear = milestones[0].year;
export const handoverYear = milestones[3].year;
export const defaultSeed = 1201;
export const presets = {
	handover: {
		label: '2030 Handover',
		sizeM: 1800,
		budget: 4,
		capacity: 82,
		storeys: 1,
		addition: 4
	},
	village: { label: 'Village', sizeM: 1200, budget: 2, capacity: 36, storeys: 1, addition: 2 },
	metropolis: {
		label: 'Metropolis',
		sizeM: 2200,
		budget: 7,
		capacity: 122,
		storeys: 2,
		addition: 7
	}
} as const;

export type StorySetup = Readonly<{
	seed: number;
	preset: keyof typeof presets;
	planFamily: CityPlanVariant;
}>;

export function nextStorySeed(seed: number) {
	return (seed + 1) % uint32Limit;
}

export function foundStory({ seed, preset, planFamily }: StorySetup) {
	const scale = presets[preset];
	const site = createCitySite(undefined, {
		seed,
		...(preset !== 'village' && { recipe: { levelHeightM: 14, storeysPerLevel: 4 } })
	});
	const recipe: CityGrowthRecipe = {
		...defaultCityGrowthRecipe,
		planFamily,
		startYear: foundingYear,
		stepYears: 5,
		endYear: handoverYear,
		carrierSizeM: scale.sizeM,
		holdingsPerStep: scale.budget,
		maximumActiveHoldings: scale.capacity,
		initialStoreys: scale.storeys,
		development: { crossingFromYear: milestones[1].year },
		eras: defaultCityGrowthRecipe.eras?.map((era) => {
			if (era.styleId === 'archigram') return { ...era, setbackDepth: 4 };
			if (era.styleId === 'organic') return { ...era, porosityRatio: 0.5 };
			return era;
		})
	};
	const initial = createCityGrowth(site, recipe, seed);
	const holdings = readCitySnapshot(initial).holdings;
	const adopted = holdings.find(({ courtAccess }) => courtAccess) ?? holdings[0];
	return { site, run: initial, adoptedId: adopted?.id };
}

/** Reserve the dated stock edits once the founding frame has been published. */
export function scheduleStoryStock(
	{ site, run, adoptedId }: ReturnType<typeof foundStory>,
	preset: StorySetup['preset']
) {
	if (!adoptedId) return run;
	const { seed, recipe } = run;
	const scale = presets[preset];
	const surveyed = readCitySnapshot(advanceCityGrowth(run, milestones[1].year));
	const earlyAddition = surveyed.holdings.find(
		({ id, courtAccess }) => courtAccess && id !== adoptedId
	);
	const split = surveyed.holdings.find(
		({ id, builtYear }) =>
			builtYear === foundingYear && id !== adoptedId && id !== earlyAddition?.id
	);
	const stockChanges: CityGrowthRecipe['stockChanges'] = [
		...(split
			? ([
					{ kind: 'retire', year: 1998, holdingId: split.id },
					{ kind: 'split', year: 1998, holdingId: split.id }
				] as const)
			: []),
		...(earlyAddition
			? ([
					{ kind: 'infill', year: 2004, storeys: 1, holdingId: earlyAddition.id },
					{ kind: 'extend', year: 2005, storeys: scale.addition, holdingId: earlyAddition.id }
				] as const)
			: []),
		{ kind: 'infill', year: milestones[2].year, storeys: 2, use: 'workshop' },
		{
			kind: 'extend',
			year: handoverYear,
			storeys: scale.addition,
			holdingId: adoptedId,
			use: 'public'
		}
	];
	// Stock changes come after the surveyed prefix and leave the founding draw intact.
	return createCityGrowth(
		site,
		{ ...recipe, stockChanges, protectedHoldingIds: [adoptedId] },
		seed
	);
}

export function readStoryHandover(run: CityGrowthRun, adoptedId?: string) {
	const { stock, document } = createSandboxHandover(run);
	const hall = stock.buildings.find(({ holdingId }) => holdingId === adoptedId);
	const lower = hall?.parts.find(
		({ kind, builtYear }) => kind === 'storey' && builtYear === foundingYear
	);
	const upper = hall?.parts.find(
		({ kind, builtYear }) => kind === 'storey' && builtYear === handoverYear
	);
	return {
		buildings: stock.buildings.length,
		publicAssets: stock.assets.length,
		placements: document.readPlacements().length,
		adoption:
			lower && upper
				? {
						retained: { id: lower.id, year: lower.builtYear },
						added: { id: upper.id, year: upper.builtYear }
					}
				: undefined
	};
}

export function growStory(run: CityGrowthRun) {
	return advanceCityGrowth(run, handoverYear);
}
