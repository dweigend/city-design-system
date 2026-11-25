import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	groveDensityBand: {
		value: [2, 6, 4, 1],
		unit: 'trees / 1000 m²',
		meaning: 'Minimum, maximum, default and step of grove density per reference area',
		principle: 'MAT-7'
	},
	groveHeightBandM: {
		value: [3, 12, 7, 1],
		unit: 'm',
		meaning: 'Minimum, maximum, default and step of grove tree height',
		principle: 'MAT-13'
	},
	groveReferenceAreaM2: {
		value: 1000,
		unit: 'm²',
		meaning: 'Area represented by one density input',
		rationale: 'Makes small holdings a clump and large holdings an open grove.'
	},
	groveMinimumDensityAreaM2: {
		value: 750,
		unit: 'm²',
		meaning: 'Area floor for mapping density to a tree count',
		rationale: 'Keeps the density control useful on small holdings, with smaller trees.'
	},
	groveTreeCount: {
		value: [3, 10],
		unit: 'trees',
		meaning: 'Minimum and maximum target tree count',
		rationale: 'Leaves room for clearings and caps grove geometry at a few hundred triangles.'
	},
	groveHeightVariationRatio: {
		value: [0.77, 1.23],
		unit: 'ratio',
		meaning: 'Tree height band around the parcel-scaled target',
		principle: 'MAT-7'
	},
	groveCanopyRadiusRatio: {
		value: [0.19, 0.32],
		unit: 'ratio',
		meaning: 'Canopy radius band relative to the height of the tree',
		principle: 'MAT-13'
	},
	groveCanopyBaseRatio: {
		value: 0.3,
		unit: 'ratio',
		meaning: 'Height where the open trunk meets the canopy',
		principle: 'MAT-13'
	},
	groveTrunkRadiusRatio: {
		value: 0.045,
		unit: 'ratio',
		meaning: 'Trunk radius as a share of total tree height',
		principle: 'MAT-13'
	},
	groveLawnLiftM: {
		value: 0.8,
		unit: 'm',
		meaning: 'Height of the matte lawn above sampled terrain',
		rationale: 'Clears the survey ground and public-ground drawing where their contours coincide.'
	},
	groveLawnPrecision: {
		value: 6,
		unit: 'decimal places',
		meaning: 'Metric precision for triangulating lawn outlines',
		rationale: 'Matches micrometer-scale plan geometry without affecting terrain sampling.'
	},
	grovePlantingAttempts: {
		value: 22,
		unit: 'samples / tree',
		meaning: 'Maximum number of site samples per planting slot',
		rationale: 'Bounds search on narrow and re-entrant holdings.'
	},
	groveSpacingRatio: {
		value: 0.82,
		unit: 'ratio',
		meaning: 'Minimum tree spacing as a share of the summed canopy radii',
		principle: 'MAT-7'
	}
});

/** Numeric grove parameters shared by the catalog and its generator. */
export const defaults = settingValues(settings);
