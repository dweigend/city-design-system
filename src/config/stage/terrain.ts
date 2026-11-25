import { defineSettings } from '../setting';

export const terrainSettings = defineSettings({
	stageContourInterval: {
		value: 2,
		unit: 'field units',
		meaning: 'Minor contour interval in the stage height field',
		rationale: 'Draws contours at every second field unit.'
	},
	stageIndexContourStride: {
		value: 5,
		unit: 'minor intervals',
		meaning: 'Number of minor contour intervals per index contour',
		rationale: 'Surfaces the primary contour rhythm.'
	},
	stageContourDerivativeFloor: {
		value: 0.0001,
		unit: 'field units/CSS px',
		meaning: 'Minimum slope used to recover contour stroke distance',
		rationale: 'Avoids division by zero on flats.'
	},
	stageContourStaggerKey: {
		value: 257,
		unit: 'hash key',
		meaning: 'Key offset of contour dot staggering',
		rationale: 'Varies dot alignment between contour levels.'
	},
	stageContourDotSpacingPx: {
		value: 2.85,
		unit: 'CSS px',
		meaning: 'Repeat spacing of minor contour pencil dots',
		rationale: 'Keeps secondary elevations readable as broken graphite traces.'
	},
	stageIndexContourDotSpacingPx: {
		value: 2.3,
		unit: 'CSS px',
		meaning: 'Repeat spacing of index contour pencil dots',
		rationale: 'Brings the main elevation marks close together so the eye follows a line.'
	},
	stageContourDotFeatherPx: {
		value: 0.24,
		unit: 'CSS px',
		meaning: 'Feather on either side of a contour dot radius',
		rationale: 'Antialiases each mark while keeping its center crisp.'
	},
	stageContourTangentBlend: {
		value: [0.37, 0.63],
		unit: 'ratio',
		meaning: 'Slope-direction band blending the two pencil axes',
		rationale: 'Keeps dots continuous when the tangent changes.'
	},
	stageContourSpacingFadePx: {
		value: [1.55, 3.25],
		unit: 'CSS px',
		meaning: 'Spacing band that fades crowded contours',
		rationale: 'Fades crowded minor lines early on steep slopes and small screens.'
	},
	stageContourSlopeFade: {
		value: [0.00035, 0.003],
		unit: 'field units/CSS px',
		meaning: 'Slope band that fades contours on flats',
		rationale: 'Keeps nearly horizontal surfaces clean.'
	},
	stageTerrainNormalFloor: {
		value: 0.0001,
		unit: 'm/m',
		meaning: 'Minimum slope used to normalize terrain facing',
		rationale: 'Prevents unstable facing near level ground.'
	},
	stageTerrainShadeSlope: {
		value: [0.04, 1.88],
		unit: 'm/m',
		meaning: 'Slope range that introduces terrain shading',
		rationale: 'Leaves level paper clean and brings out terrace faces before the steepest grades.'
	},
	stageTerrainFacingLight: {
		value: 0.055,
		unit: 'Oklab lightness',
		meaning: 'Directional contribution to terrain shading',
		rationale: 'Separates sun-facing and shaded slopes at the same grade.'
	},
	stageTerrainDarken: {
		value: 0.335,
		unit: 'Oklab lightness',
		meaning: 'Slope darkening at full steepness before facing and bank adjustments',
		rationale: 'Sets the contrast between light paper flats and shaded relief.'
	},
	stageBankShadeFadeM: {
		value: [6, 76],
		unit: 'm',
		meaning: 'Distance band that fades bank shading',
		rationale: 'Confines the contact shadow to a narrow band beside the water.'
	},
	stageBankShadeStrength: {
		value: 0.105,
		unit: 'Oklab lightness',
		meaning: 'Maximum bank shading strength',
		rationale: 'Separates the accent water from adjoining terrain at the shore.'
	},
	stageDarkSteepnessLift: {
		value: 0.51,
		unit: 'Oklab lightness',
		meaning: 'Dark-theme terrain lightness added with steepness',
		rationale:
			'Reverses the relief contrast with enough headroom for pale structure and plan lines.'
	},
	stageDarkTerrainLift: {
		value: 0.05,
		unit: 'Oklab lightness',
		meaning: 'Dark-theme terrain base lightness lift',
		rationale: 'Separates level ground from the background while keeping it near black.'
	},
	stageMinorContourRadiusPx: {
		value: 0.73,
		unit: 'CSS px',
		meaning: 'Pencil dot radius for minor contours',
		rationale: 'Makes secondary contours readable at phone scale.'
	},
	stageIndexContourRadiusPx: {
		value: 0.99,
		unit: 'CSS px',
		meaning: 'Pencil dot radius for index contours',
		rationale: 'Gives the main elevations a stronger line weight than minor contours.'
	},
	stageMinorContourInk: {
		value: 0.35,
		unit: 'ratio',
		meaning: 'Minor contour ink mix in the light palette',
		rationale: 'Keeps minor contours subordinate to index contours.'
	},
	stageDarkMinorContourInkLift: {
		value: -0.05,
		unit: 'ratio',
		meaning: 'Change in minor contour ink mix in the dark palette',
		rationale: 'Balances the contrast of pale dots on near-black paper.'
	},
	stageIndexContourInk: {
		value: 0.77,
		unit: 'ratio',
		meaning: 'Index contour ink mix in the light palette',
		rationale: 'Makes the main contours easy to follow.'
	},
	stageDarkIndexContourInkShift: {
		value: -0.19,
		unit: 'ratio',
		meaning: 'Change in index contour ink mix in the dark palette',
		rationale: 'Keeps primary contours pale and distinct while foreground overlays retain focus.'
	}
});
