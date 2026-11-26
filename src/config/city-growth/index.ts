import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	carrierSizeM: {
		value: 1800,
		unit: 'm',
		bounds: { exclusiveMin: 0 },
		meaning: 'City site selection available for settlement',
		principle: 'CITY-11'
	},
	startYear: {
		value: 1950,
		unit: 'year',
		bounds: { min: -10000, max: 10000 },
		meaning: 'Founding year and origin of the growth schedule',
		principle: 'GROW-4'
	},
	endYear: {
		value: 2030,
		unit: 'year',
		bounds: { min: -10000, max: 10000 },
		meaning: 'Last year that can receive a scheduled event',
		principle: 'GROW-4'
	},
	stepYears: {
		value: 10,
		unit: 'year',
		bounds: { min: 1, max: 20000 },
		meaning: 'Interval between growth budgets',
		principle: 'GROW-1'
	},
	minimumFoundingHoldings: {
		value: 4,
		unit: 'count',
		bounds: { min: 1 },
		meaning: 'Size of the founding cluster',
		principle: 'GROW-4'
	},
	holdingsPerStep: {
		value: 8,
		unit: 'count',
		bounds: { min: 0 },
		meaning: 'Most holdings that can settle per scheduled year',
		principle: 'GROW-1'
	},
	maximumActiveHoldings: {
		value: 68,
		unit: 'count',
		bounds: { min: 1 },
		meaning: 'Cap on active holdings over the run',
		principle: 'GROW-4'
	},
	maximumLaneHops: {
		value: 3,
		unit: 'count',
		bounds: { min: 1, max: 8 },
		meaning: 'Most new lane intervals that can connect one holding to the settled network',
		rationale:
			'Keeps settlement close to the occupied frontage while letting a few vacant intervals link blocks'
	},
	initialStoreys: {
		value: 2,
		unit: 'count',
		bounds: { min: 1, max: 20 },
		meaning: 'Initial storeys on each settled holding',
		principle: 'GROW-3'
	},
	buildingRadiusShare: {
		value: 0.8,
		unit: 'ratio',
		bounds: { exclusiveMin: 0, exclusiveMax: 1 },
		meaning: 'Share of the inscribed square radius used by initial buildings',
		rationale: 'Leaves part of the holding open and keeps the building inside the frontage boundary'
	},
	minimumFloodFreeboardM: {
		value: 1.5,
		unit: 'm',
		bounds: { min: 0 },
		meaning: 'Minimum elevation above the sampled local channel surface',
		principle: 'CITY-13'
	},
	preferredTerraceHeightM: {
		value: 7,
		unit: 'm',
		bounds: { min: 0 },
		meaning: 'Preferred terrace elevation above the local channel',
		rationale: 'Favors low ground with room above the ordinary river stage'
	},
	terraceHeightScaleM: {
		value: 12,
		unit: 'm',
		bounds: { exclusiveMin: 0 },
		meaning: 'Height difference from the preferred terrace at which the terrace score halves',
		principle: 'CITY-13'
	},
	shelterProbeDistanceM: {
		value: 80,
		unit: 'm',
		bounds: { exclusiveMin: 0 },
		meaning: 'Distance to sample each flank across the valley',
		rationale: 'Reads the surrounding relief beyond the parcel'
	},
	shelterRiseScaleM: {
		value: 12,
		unit: 'm',
		bounds: { exclusiveMin: 0 },
		meaning: 'Rise of a dry flank that gives half the maximum shelter score',
		rationale: 'Rewards nearby higher ground as a proxy for shelter'
	},
	waterSearchRadiusM: {
		value: 320,
		unit: 'm',
		bounds: { exclusiveMin: 0 },
		meaning: 'Maximum XY distance for a sampled channel to supply a local reference height',
		rationale: 'A distant channel is a poor guide to the height of a local terrace'
	},
	landingDistanceScaleM: {
		value: 120,
		unit: 'm',
		bounds: { exclusiveMin: 0 },
		meaning: 'Distance at which the landing proximity score halves',
		principle: 'CITY-13'
	},
	accessDistanceScaleM: {
		value: 45,
		unit: 'm',
		bounds: { exclusiveMin: 0 },
		meaning: 'New lane length at which the frontage access score halves',
		principle: 'CITY-6'
	},
	terraceWeight: {
		value: 2,
		unit: 'score',
		bounds: { min: 0, max: 100 },
		meaning: 'Preference for a dry lower terrace',
		principle: 'CITY-13'
	},
	landingWeight: {
		value: 1.25,
		unit: 'score',
		bounds: { min: 0, max: 100 },
		meaning: 'Preference for nearby dry landing approaches',
		principle: 'CITY-13'
	},
	slopeWeight: {
		value: 3,
		unit: 'score',
		bounds: { min: 0, max: 100 },
		meaning: 'Penalty for relative ground rise inside the holding',
		principle: 'CITY-13'
	},
	shelterWeight: {
		value: 0.6,
		unit: 'score',
		bounds: { min: 0, max: 100 },
		meaning: 'Preference for a terrace with higher ground to either side of the valley axis',
		principle: 'CITY-13'
	},
	neighborWeight: {
		value: 0.75,
		unit: 'score',
		bounds: { min: 0, max: 100 },
		meaning: 'Preference for nearby eligible holdings',
		principle: 'CITY-6'
	},
	laneAccessWeight: {
		value: 2,
		unit: 'score',
		bounds: { min: 0, max: 100 },
		meaning: 'Preference for existing frontage and short extensions',
		principle: 'CITY-6'
	},
	seedVariationWeight: {
		value: 0.8,
		unit: 'score',
		bounds: { min: 0, max: 100 },
		meaning: 'Maximum score contribution from a keyed seed draw',
		principle: 'CITY-11'
	}
});

export const defaults = settingValues(settings);
