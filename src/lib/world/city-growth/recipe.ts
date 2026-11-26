import { defaults, settings } from '../../../config/city-growth';
import { houseStyles } from '../../domain/house-court';
import { cityPlanVariants, citySiteParams } from '../city-site';
import type {
	CityConstructionEra,
	CityGrowthPart,
	CityGrowthRecipe,
	CityStockChange
} from './types';

const { memphisFromYear, archigramFromYear, organicFromYear, ...numericDefaults } = defaults;
const {
	maximumAdditionStoreys,
	maximumSetbackDepth,
	minimumSplitAreaM2,
	minimumSplitFrontageM,
	minimumSplitDepthM,
	...recipeDefaults
} = numericDefaults;

export const splitMinimums = Object.freeze({
	areaM2: minimumSplitAreaM2,
	frontageM: minimumSplitFrontageM,
	depthM: minimumSplitDepthM
});

const neutral: CityConstructionEra = Object.freeze({
	fromYear: settings.startYear.bounds.min,
	styleId: 'neutral'
});
const defaultEras: readonly CityConstructionEra[] = Object.freeze([
	neutral,
	Object.freeze({ fromYear: memphisFromYear, styleId: 'memphis' }),
	Object.freeze({ fromYear: archigramFromYear, styleId: 'archigram' }),
	Object.freeze({ fromYear: organicFromYear, styleId: 'organic' })
]);

export const defaultRecipe: CityGrowthRecipe = Object.freeze({
	...recipeDefaults,
	planFamily: 'organic',
	eras: defaultEras
});

export function readEra(recipe: CityGrowthRecipe, year: number): CityConstructionEra {
	return recipe.eras?.findLast(({ fromYear }) => fromYear <= year) ?? neutral;
}

const integerFields = new Set<keyof CityGrowthRecipe>([
	'startYear',
	'endYear',
	'stepYears',
	'minimumFoundingHoldings',
	'holdingsPerStep',
	'maximumActiveHoldings',
	'maximumLaneHops',
	'initialStoreys'
]);

function isWithinBounds(
	value: number,
	{
		min,
		max,
		exclusiveMin,
		exclusiveMax
	}: {
		min?: number;
		max?: number;
		exclusiveMin?: number;
		exclusiveMax?: number;
	}
) {
	return (
		(min === undefined || value >= min) &&
		(max === undefined || value <= max) &&
		(exclusiveMin === undefined || value > exclusiveMin) &&
		(exclusiveMax === undefined || value < exclusiveMax)
	);
}

export function captureRecipe(input: CityGrowthRecipe): CityGrowthRecipe {
	if (!cityPlanVariants.includes(input.planFamily)) throw new RangeError('Unknown plan family');
	for (const key of Object.keys(recipeDefaults) as (keyof typeof recipeDefaults)[]) {
		const value = input[key];
		if (
			!Number.isFinite(value) ||
			(integerFields.has(key) && !Number.isSafeInteger(value)) ||
			!isWithinBounds(value, settings[key].bounds)
		)
			throw new RangeError(`Invalid city growth recipe value for ${key}`);
	}
	const { min, max } = citySiteParams.citySize;
	if (input.carrierSizeM < min || input.carrierSizeM > max)
		throw new RangeError('City growth carrier size lies outside the city site range');
	if (input.startYear > input.endYear)
		throw new RangeError('Founding year must precede or equal end year');
	if (input.minimumFoundingHoldings > input.maximumActiveHoldings)
		throw new RangeError('Founding cluster must fit inside the active holding limit');
	return Object.freeze({
		...input,
		eras: captureEras(input.eras ?? defaultEras),
		stockChanges: captureChanges(input),
		protectedHoldingIds: Object.freeze([...(input.protectedHoldingIds ?? [])])
	});
}

function captureEras(eras: readonly CityConstructionEra[]) {
	let previous = -Infinity;
	return Object.freeze(
		Array.from(eras, (era) => {
			const { fromYear, styleId } = era;
			const setbackDepth = era.setbackDepth ?? 0;
			const porosityRatio = era.porosityRatio ?? 0;
			if (
				!Number.isSafeInteger(fromYear) ||
				fromYear <= previous ||
				!Object.hasOwn(houseStyles, styleId) ||
				!Number.isSafeInteger(setbackDepth) ||
				setbackDepth < 0 ||
				setbackDepth > maximumSetbackDepth ||
				!Number.isFinite(porosityRatio) ||
				porosityRatio < 0 ||
				porosityRatio > 1
			)
				throw new RangeError('Invalid city construction era or year order');
			previous = fromYear;
			return Object.freeze({ ...era });
		})
	);
}

const uses: ReadonlySet<CityGrowthPart['use']> = new Set([
	'public',
	'workshop',
	'office',
	'housing',
	'city-farm',
	'greenhouse'
]);

function validateChange(change: CityStockChange) {
	switch (change.kind) {
		case 'infill':
		case 'extend':
			if (
				!Number.isSafeInteger(change.storeys) ||
				change.storeys < 1 ||
				change.storeys > maximumAdditionStoreys ||
				(change.use !== undefined && !uses.has(change.use))
			)
				throw new RangeError('Invalid infill or extension program');
			return;
		case 'convert':
			if (!uses.has(change.use) || (change.fromUse !== undefined && !uses.has(change.fromUse)))
				throw new RangeError('Invalid conversion use');
			return;
		case 'retire':
		case 'split':
			return;
		default:
			throw new RangeError('Unknown city stock change');
	}
}

function captureChanges({ stockChanges = [], startYear, endYear }: CityGrowthRecipe) {
	const captured = Array.from(stockChanges, (change) => {
		if (!Number.isSafeInteger(change.year) || change.year <= startYear || change.year > endYear)
			throw new RangeError('City stock changes must follow founding and fit inside the run');
		validateChange(change);
		return Object.freeze({ ...change });
	});
	return Object.freeze(captured.sort((a, b) => a.year - b.year));
}
