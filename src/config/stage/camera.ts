import { defineSettings } from '../setting';

export const cameraSettings = defineSettings({
	navigationMinZoom: {
		value: 0.55,
		unit: 'ratio',
		meaning: 'Minimum relative camera zoom during navigation',
		rationale: 'Preserves the standard stage zoom range.'
	},
	navigationMaxZoom: {
		value: 32,
		unit: 'ratio',
		meaning: 'Maximum relative camera zoom during navigation',
		rationale: 'Preserves the standard stage zoom range.'
	},
	stageBearingRad: {
		value: (32 * Math.PI) / 180,
		unit: 'rad',
		meaning: 'Default oblique camera bearing from north',
		rationale: 'Shows two sides of the model.'
	},
	stageElevationRad: {
		value: (26 * Math.PI) / 180,
		unit: 'rad',
		meaning: 'Default oblique camera elevation',
		rationale: 'Shows the top while keeping walls prominent.'
	},
	stageObliqueFill: {
		value: 0.7,
		unit: 'ratio',
		meaning: 'Frame share used by default in the oblique view',
		rationale: 'Leaves space for a cast shadow and pan.'
	},
	stagePlanFill: {
		value: 0.63,
		unit: 'ratio',
		meaning: 'Frame share used by default in the plan view',
		rationale: 'Leaves a clear margin around the plan.'
	},
	stageMinimumFitHeightM: {
		value: 0.05,
		unit: 'm',
		meaning: 'Smallest height considered by camera fitting',
		rationale: 'Keeps point-sized subjects from collapsing the view.'
	},
	stageMinimumDepthMarginM: {
		value: 1,
		unit: 'm',
		meaning: 'Minimum padding around the clipping depth',
		rationale: 'Keeps thin scenes inside the clip planes.'
	},
	stageSubjectHeightDepthMarginRatio: {
		value: 1.2,
		unit: 'ratio',
		meaning: 'Clip padding per meter of subject half-height',
		rationale: 'Keeps tall subjects visible while panning.'
	},
	stageSceneDepthMarginRatio: {
		value: 0.01,
		unit: 'ratio',
		meaning: 'Clip padding per meter of scene depth',
		rationale: 'Allows proportionate padding in deep scenes.'
	},
	stageShadowFitFill: {
		value: 0.9,
		unit: 'ratio',
		meaning: 'Default frame share for the subject and its projected shadow',
		rationale: 'Leaves a small margin around their combined outline.'
	},
	stageGroundRayTolerance: {
		value: 1e-9,
		unit: 'ratio',
		meaning: 'Vertical component below which a ground ray is treated as parallel',
		rationale: 'Avoids an unstable ground projection for nearly horizontal rays.'
	},
	stageMaxPixelRatio: {
		value: 2,
		unit: 'device px/CSS px',
		meaning: 'Maximum drawing buffer density',
		rationale: 'Limits GPU buffer size on high-density displays.'
	},
	stageTimingDigits: {
		value: 2,
		unit: 'decimal digits',
		meaning: 'Fraction digits in frame and mesh timing attributes',
		rationale: 'Keeps submillisecond detail in performance probes.'
	},
	stageWheelLinePx: {
		value: 16,
		unit: 'CSS px/line',
		meaning: 'Wheel line-mode delta converted to pixels',
		rationale: 'Keeps line-mode zoom comparable to pixel-mode zoom.'
	},
	stageKeyPanPx: {
		value: 40,
		unit: 'CSS px',
		meaning: 'Pan distance per arrow key press',
		rationale: 'Moves the view by a readable increment.'
	},
	stageKeyZoomIn: {
		value: 1.25,
		unit: 'ratio',
		meaning: 'Zoom multiplier per plus key press',
		rationale: 'Steps inward by a fixed proportional increment.'
	},
	stageWheelZoomRate: {
		value: 0.0017,
		unit: '1/CSS px',
		meaning: 'Exponent per wheel pixel',
		rationale: 'Keeps scroll zoom gradual.'
	}
});
