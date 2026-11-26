import { defaults, settings } from '../../../config/city-growth';
import { cityPlanVariants, citySiteParams } from '../city-site';
import type { CityGrowthRecipe } from './types';

export const defaultRecipe: CityGrowthRecipe = Object.freeze({
	...defaults,
	planFamily: 'organic'
});

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
	for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
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
	return Object.freeze({ ...input });
}
