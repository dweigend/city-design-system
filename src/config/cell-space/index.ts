import { defineSettings, settingValues } from '../setting';

/** Numeric settings of the fine cell space inside a parcel or bay. */
export const settings = defineSettings({
	refinementRounds: {
		value: 1,
		unit: 'count',
		meaning:
			'Default midpoint refinement rounds applied to every corner quad after the first split',
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
		rationale:
			'Each round multiplies the cells by four; three rounds give 64 cells per corner quad.'
	},
	storeyHeightM: {
		value: 3.5,
		unit: 'm',
		meaning: 'Default storey height of a cell space, two storeys per 7 m coarse level',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-12'
	},
	stripTargetEdgeM: {
		value: 6.5,
		unit: 'm',
		meaning:
			'Target edge of a strip cell: frontage length and parcel depth divided by it give columns and depth rows',
		bounds: { exclusiveMin: 0 },
		principle: 'GRID-1',
		rationale:
			'About two structural bays of a town house; a 9 × 12 m plot becomes two cells, a 20 × 15 m plot six.'
	},
	stripMinimumCells: {
		value: 2,
		unit: 'count',
		meaning: 'Fewest strip cells a parcel aims for: a front and a rear row',
		bounds: { min: 1 },
		principle: 'GRID-1'
	},
	stripMaximumCells: {
		value: 48,
		unit: 'count',
		meaning: 'Most strip cells per parcel; a larger parcel takes proportionally larger cells',
		bounds: { min: 1 },
		principle: 'GRID-1',
		rationale: 'A 5,600 m² hall then spans about 11 m per cell, a large span instead of a field.'
	},
	stripMinimumWidthM: {
		value: 2.4,
		unit: 'm',
		meaning:
			'Smallest accepted width of a strip cell (twice its area over its perimeter); narrower cuts merge',
		bounds: { exclusiveMin: 0 },
		principle: 'GRID-1',
		rationale: 'Below a room width a cell reads as a sliver and cannot hold a body or a stair.'
	},
	stripStraightSineRatio: {
		value: 0.26,
		unit: 'ratio',
		meaning:
			'Sine of the largest turn at which a parcel corner continues a side instead of ending it (about 15°)',
		bounds: { min: 0, max: 1 },
		principle: 'GRID-1',
		rationale: 'Parcel cuts leave nearly straight corners on long sides; they must not end a side.'
	},
	stripConcaveSineRatio: {
		value: 0.035,
		unit: 'ratio',
		meaning: 'Sine of the largest inward turn a strip cell may keep at a corner (about 2°)',
		bounds: { min: 0, max: 1 },
		principle: 'GRID-1',
		rationale: 'Nearly straight parcel corners on a cell side stay; a real re-entrant corner does not.'
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
