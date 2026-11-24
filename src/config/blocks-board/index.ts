import { defineSettings, settingValues } from '../setting';

/** Metric specimen spacing and framing for the Blocks board. */
export const settings = defineSettings({
	boardMaximumColumns: {
		value: 5,
		unit: 'count',
		meaning: 'Columns on the full board',
		bounds: { min: 1 },
		rationale: 'Keeps each row readable at the chapter width.'
	},
	boardCompactColumns: {
		value: 2,
		unit: 'count',
		meaning: 'Columns for small filtered selections',
		bounds: { min: 1 },
		rationale: 'Keeps a small collection centered.'
	},
	boardCompactLimit: {
		value: 4,
		unit: 'count',
		meaning: 'Largest selection shown on a compact board',
		bounds: { min: 1 },
		rationale: 'Fits the four house styles in two rows.'
	},
	boardPlotSideM: {
		value: 16,
		unit: 'm',
		meaning: 'Side of the specimen plot',
		bounds: { exclusiveMin: 0 },
		rationale: 'One metric plot size across registered assets.'
	},
	boardColumnPitchM: {
		value: 22,
		unit: 'm',
		meaning: 'Center separation across columns',
		bounds: { exclusiveMin: 0 },
		rationale: 'Leaves a gap between adjacent plinths.'
	},
	boardRowPitchM: {
		value: 34,
		unit: 'm',
		meaning: 'Center separation between rows',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps tall specimens clear at the board elevation.'
	},
	boardPlinthHeightM: {
		value: 0.6,
		unit: 'm',
		meaning: 'Thickness of the specimen plinth',
		bounds: { exclusiveMin: 0 },
		rationale: 'Gives each specimen a visible base.'
	},
	boardPlinthRimM: {
		value: 0.5,
		unit: 'm',
		meaning: 'Rim around each specimen plot',
		bounds: { min: 0 },
		rationale: 'Keeps specimen edges distinct from the plinth edges.'
	},
	boardSeed: {
		value: 73,
		unit: 'seed',
		meaning: 'Fixed seed for the specimens',
		bounds: { min: 0 },
		rationale: 'Keeps the same board across display and filter changes.'
	},
	boardFitFill: {
		value: 0.87,
		unit: 'ratio',
		meaning: 'Fraction of the frame occupied by the board',
		bounds: { min: 0, max: 1 },
		rationale: 'Leaves a margin around the full board.'
	},
	boardFitBearingRad: {
		value: 0.18,
		unit: 'rad',
		meaning: 'Board camera bearing',
		rationale: 'Keeps rows distinct with a slight diagonal.'
	},
	boardFitElevationRad: {
		value: 0.76,
		unit: 'rad',
		meaning: 'Board camera elevation',
		rationale: 'Shows both footprint and height of the specimens.'
	},
	boardFitOffsetYM: {
		value: -1,
		unit: 'm',
		meaning: 'Vertical frame offset for the board',
		rationale: 'Centers the raised specimens in the view.'
	}
});

/** Frozen Blocks board settings. */
export const defaults = settingValues(settings);
