import { createFacadeBands, createTensionPatch, type TensionPatchSpec } from './index';

/** Fixed frontage and canopy survey, shared by the envelope contract and chapter. */
export const canopySurvey = {
	id: 'canopy',
	corners: [
		{ id: 'south-west', position: [-10, -4, 10] },
		{ id: 'south-east', position: [10, -4, 6] },
		{ id: 'north-east', position: [10, 4, 10] },
		{ id: 'north-west', position: [-10, 4, 6] }
	],
	edgeGrips: [
		{ id: 'south-edge', position: [0, -4, 6.4] },
		undefined,
		{ id: 'north-edge', position: [0, 4, 6.4] },
		undefined
	]
} as const satisfies TensionPatchSpec;

/** Spans three bays across a return and four noncoplanar canopy corners. */
export function example() {
	return {
		bands: createFacadeBands({
			id: 'frontage',
			grips: [
				{ id: 'west', position: [-10, -4, 2.5] },
				{ id: 'south', position: [-3, -4, 2.5] },
				{ id: 'east', position: [4, -4, 2.5] },
				{ id: 'return', position: [10, -3, 2.5] }
			],
			bandCount: 3,
			bandHeightM: 0.58,
			pitchM: 1.25
		}),
		patch: createTensionPatch(canopySurvey)
	};
}
