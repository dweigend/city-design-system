import type { Setting } from '../setting';

export const terraces = {
	floodplainLevelM: {
		value: 1.4,
		unit: 'm',
		meaning: 'Floodplain elevation above the local water datum',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	lowerTerraceRiseBandM: {
		value: [6.2, 7] as const,
		unit: 'm',
		meaning: 'Seeded rise from floodplain to lower terrace',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	upperTerraceRiseBandM: {
		value: [9.1, 9.55] as const,
		unit: 'm',
		meaning: 'Seeded rise from lower to upper terrace',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	nearTerraceEdgeBandM: {
		value: [325, 355] as const,
		unit: 'm',
		meaning: 'Seeded offset from the axis to the near lower terrace edge',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	farTerraceEdgeBandM: {
		value: [590, 666] as const,
		unit: 'm',
		meaning: 'Seeded offset from the axis to the far lower terrace edge',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	farTerraceWideningBandM: {
		value: [-35, 65] as const,
		unit: 'm',
		meaning: 'Seeded change in far terrace offset over one bow span',
		principle: 'CITY-11'
	},
	valleyAxisBowGainBandRatio: {
		value: [0.95, 1.05] as const,
		unit: 'ratio',
		meaning: 'Seeded fraction of chord offset retained as axis bow',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	valleyAxisChordReachM: {
		value: 1125,
		unit: 'm',
		meaning: 'Half-length along the course used to establish the terrace axis',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	upperSetbackM: {
		value: 158,
		unit: 'm',
		meaning: 'Lateral offset from lower to upper terrace edge',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	lowerTerraceTransitionHalfRunM: {
		value: 24,
		unit: 'm',
		meaning: 'Half-width of the transition to the lower terrace',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	upperTerraceTransitionHalfRunM: {
		value: 38,
		unit: 'm',
		meaning: 'Half-width of the transition to the upper terrace',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	apronRiseM: {
		value: 1.4,
		unit: 'm',
		meaning: 'Vertical rise from the upper terrace toward the slopes',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	apronSetbackM: {
		value: 310,
		unit: 'm',
		meaning: 'Offset behind the upper terrace at the center of the apron rise',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	apronHalfRunM: {
		value: 220,
		unit: 'm',
		meaning: 'Half-width of the apron rise',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	valleyDatumSlopeRatio: {
		value: 0.00025,
		unit: 'rise/run',
		meaning: 'Longitudinal fall of the inherited valley datum',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	farBeltEdgeM: {
		value: 690,
		unit: 'm',
		meaning: 'Regional lower terrace edge on the open side',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	nearBeltEdgeM: {
		value: 475,
		unit: 'm',
		meaning: 'Regional lower terrace edge on the close side',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	terraceFrameStationLimitM: {
		value: 500,
		unit: 'm',
		meaning: 'Maximum absolute station queried for a central terrace frame',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	terraceFrameDrySearchStepM: {
		value: 5,
		unit: 'm',
		meaning: 'Lateral step for finding dry land at the terrace frame',
		bounds: { exclusiveMin: 0 },
		rationale: 'Samples both sides of the nominal anchor without changing their priority.'
	},
	terraceFrameDrySearchLimitM: {
		value: 155,
		unit: 'm',
		meaning: 'Maximum distance searched from a wet terrace frame anchor',
		bounds: { exclusiveMin: 0 },
		rationale: 'Limits how far a frame may move away from the requested terrace station.'
	}
} as const satisfies Readonly<Record<string, Setting>>;
