import { defineSettings, settingValues } from '../setting';

/** Drawing and control values for the structural study. */
export const settings = defineSettings({
	primaryStrokePx: {
		value: 1.35,
		unit: 'px',
		meaning: 'Visible minimum for the primary frame',
		principle: 'FORM-6'
	},
	secondaryStrokePx: {
		value: 0.56,
		unit: 'px',
		meaning: 'Hairline weight for secondary members',
		principle: 'FORM-6'
	},
	secondaryOpacity: {
		value: 0.46,
		unit: 'ratio',
		meaning: 'Opacity of light member strokes',
		principle: 'MAT-6'
	},
	stockFillOpacity: {
		value: 0.48,
		unit: 'ratio',
		meaning: 'Opacity of town stock below the main frame',
		principle: 'MAT-6'
	},
	stockStrokeOpacity: {
		value: 0.24,
		unit: 'ratio',
		meaning: 'Opacity of the town stock outlines',
		principle: 'MAT-6'
	},
	portalFrameFill: {
		value: 0.81,
		unit: 'ratio',
		meaning: 'Share of the stage framed by the portal and force arrows',
		rationale: 'Leaves a margin beyond the top and bottom arrow tails'
	},
	townFrameFill: {
		value: 0.86,
		unit: 'ratio',
		meaning: 'Share of the stage framed by the town structure',
		rationale: 'Leaves terrain visible beyond the frame boundaries'
	},
	analysisStrokePx: {
		value: 1.65,
		unit: 'px',
		meaning: 'Minimum pixel width of coloured force members',
		principle: 'COLOR-7'
	},
	utilizationOverloadRatios: {
		value: [1.5, 2],
		unit: 'ratio',
		meaning: 'Starts of the second and third overload bands',
		principle: 'COLOR-7'
	},
	supportWidthM: {
		value: 0.92,
		unit: 'm',
		meaning: 'Square bearing marker width',
		rationale: 'Readable at the scale of the standalone frame'
	},
	supportHeightM: {
		value: 0.24,
		unit: 'm',
		meaning: 'Bearing marker depth below its joint',
		rationale: 'Shows where the frame is seated'
	},
	arrowBaseM: {
		value: 0.6,
		unit: 'm',
		meaning: 'Minimum length of a nonzero force arrow',
		rationale: 'Keeps a small load visible beside the member'
	},
	arrowReferenceKN: {
		value: 2400,
		unit: 'kN',
		meaning: 'Force producing one meter of additional arrow length',
		rationale: 'Keeps portal reactions close to their seats'
	},
	arrowHeadM: {
		value: 0.32,
		unit: 'm',
		meaning: 'Arrowhead length',
		rationale: 'Makes force direction visible'
	},
	arrowWidthM: {
		value: 0.095,
		unit: 'm',
		meaning: 'Width of the force arrow shaft',
		rationale: 'Lets arrows read beside the structural sections'
	}
});

/** Values consumed by the structural projection. */
export const defaults = settingValues(settings);
