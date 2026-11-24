import { defineSettings, settingValues } from '../setting';

/** Numeric settings of the fine cell space inside a parcel or bay. */
export const settings = defineSettings({
	refinementRounds: {
		value: 1,
		unit: 'count',
		meaning: 'Default midpoint refinement rounds applied to every corner quad after the first split',
		bounds: { min: 0 },
		principle: 'GRID-1',
		rationale:
			'One round gives every corner quad an inner cell, so a court can stay open on any parcel shape.'
	},
	maximumRefinementRounds: {
		value: 3,
		unit: 'count',
		meaning: 'Largest accepted number of refinement rounds',
		bounds: { min: 0 },
		rationale: 'Each round multiplies the cells by four; three rounds give 64 cells per corner quad.'
	},
	storeyHeightM: {
		value: 3.5,
		unit: 'm',
		meaning: 'Default storey height of a cell space, two storeys per 7 m coarse level',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-12'
	},
	minimumEdgeM: {
		value: 0.01,
		unit: 'm',
		meaning: 'Shortest accepted parcel edge; shorter edges make the parcel degenerate',
		bounds: { exclusiveMin: 0 },
		rationale: 'A centimetre is far below any buildable feature and far above roundoff.'
	}
});

/** Frozen defaults consumed by the owning module. */
export const defaults = settingValues(settings);
