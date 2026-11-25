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
		value: 3.3,
		unit: 'CSS px',
		meaning: 'Repeat spacing of contour pencil dots',
		rationale: 'Keeps curves visible as a broken pencil trace.'
	},
	stageContourDotFeatherPx: {
		value: 0.28,
		unit: 'CSS px',
		meaning: 'Feather on either side of a contour dot radius',
		rationale: 'Smooths the outline of small screen-space dots.'
	},
	stageContourTangentBlend: {
		value: [0.37, 0.63],
		unit: 'ratio',
		meaning: 'Slope-direction band blending the two pencil axes',
		rationale: 'Keeps dots continuous when the tangent changes.'
	},
	stageContourSpacingFadePx: {
		value: [1.25, 2.65],
		unit: 'CSS px',
		meaning: 'Spacing band that fades crowded contours',
		rationale: 'Reduces contour clutter where the lines converge.'
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
		value: [0.018, 2.45],
		unit: 'm/m',
		meaning: 'Slope range that introduces terrain shading',
		rationale: 'Retains pale flats and gives steep slopes shape.'
	},
	stageTerrainFacingLight: {
		value: 0.032,
		unit: 'Oklab lightness',
		meaning: 'Directional contribution to terrain shading',
		rationale: 'Keeps subtle orientation cues.'
	},
	stageTerrainDarken: {
		value: 0.262,
		unit: 'Oklab lightness',
		meaning: 'Darkest terrain shading offset',
		rationale: 'Keeps terrain relief legible without burying contours.'
	},
	stageBankShadeFadeM: {
		value: [6, 102],
		unit: 'm',
		meaning: 'Distance band that fades bank shading',
		rationale: 'Gives the water edge a soft contact shadow.'
	},
	stageBankShadeStrength: {
		value: 0.085,
		unit: 'Oklab lightness',
		meaning: 'Maximum bank shading strength',
		rationale: 'Anchors water without a hard border.'
	},
	stageDarkSteepnessLift: {
		value: 0.41,
		unit: 'Oklab lightness',
		meaning: 'Dark-theme terrain lightness added with steepness',
		rationale: 'Keeps steep surfaces distinguishable from the background.'
	},
	stageDarkTerrainLift: {
		value: 0.079,
		unit: 'Oklab lightness',
		meaning: 'Dark-theme terrain base lightness lift',
		rationale: 'Keeps level ground readable in the dark palette.'
	},
	stageMinorContourRadiusPx: {
		value: 0.66,
		unit: 'CSS px',
		meaning: 'Pencil dot radius for minor contours',
		rationale: 'Keeps intermediate contours fine.'
	},
	stageIndexContourRadiusPx: {
		value: 0.79,
		unit: 'CSS px',
		meaning: 'Pencil dot radius for index contours',
		rationale: 'Makes index contours slightly stronger.'
	},
	stageMinorContourInk: {
		value: 0.25,
		unit: 'ratio',
		meaning: 'Minor contour ink mix in the light palette',
		rationale: 'Keeps minor contours subordinate to index contours.'
	},
	stageDarkMinorContourInkLift: {
		value: 0.1,
		unit: 'ratio',
		meaning: 'Additional minor contour ink mix in the dark palette',
		rationale: 'Keeps the minor dots visible on dark paper.'
	},
	stageIndexContourInk: {
		value: 0.5,
		unit: 'ratio',
		meaning: 'Index contour ink mix in the light palette',
		rationale: 'Makes the main contours easy to follow.'
	},
	stageDarkIndexContourInkShift: {
		value: -0.15,
		unit: 'ratio',
		meaning: 'Change in index contour ink mix in the dark palette',
		rationale: 'Softens the darkest contour mark on the dark theme.'
	}
});
