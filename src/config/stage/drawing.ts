import { defineSettings } from '../setting';

export const drawingSettings = defineSettings({
	stageEdgeWeldPerM: {
		value: 10_000,
		unit: 'grid intervals/m',
		meaning: 'Resolution of the stage edge welding grid',
		rationale: 'Matches coincident projected vertices through roundoff.'
	},
	stageCreaseAngleRad: {
		value: Math.PI / 180,
		unit: 'rad',
		meaning: 'Minimum default fold angle for a crease stroke',
		rationale: 'Ignores near-planar triangulation edges.'
	},
	stageEdgeFacingTolerance: {
		value: 1e-5,
		unit: 'ratio',
		meaning: 'Normal-to-eye dot product that counts as front-facing',
		rationale: 'Avoids flickering silhouettes at grazing angles.'
	},
	stageTerrainPencilDepthBias: {
		value: -96,
		unit: 'depth units',
		meaning: 'Polygon offset for the landscape pencil lines',
		rationale: 'Keeps landscape pencil lines visible against the fill.'
	},
	stageOuterStrokePx: {
		value: 1.4,
		unit: 'CSS px',
		meaning: 'Default silhouette stroke width',
		rationale: 'Keeps the object outline visible.'
	},
	stageLandscapeCreaseStrokePx: {
		value: 1.35,
		unit: 'CSS px',
		meaning: 'Default landscape crease stroke width',
		rationale: 'Makes the creases of the terrain block legible.'
	},
	stageObjectCreaseStrokePx: {
		value: 0.75,
		unit: 'CSS px',
		meaning: 'Default object crease stroke width',
		rationale: 'Keeps interior edges lighter than the silhouette.'
	},
	stageGridDepthFactor: {
		value: -1,
		unit: 'depth slope factor',
		meaning: 'Land grid polygon offset factor',
		rationale: 'Pulls plan grid lines forward on sloping terrain.'
	},
	stageGridDepthBias: {
		value: -16384,
		unit: 'depth units',
		meaning: 'Land grid polygon offset units',
		rationale: 'Keeps the grid readable against terrain.'
	},
	stageGridStrokePx: {
		value: 1.5,
		unit: 'CSS px',
		meaning: 'Interior terrain grid stroke width',
		rationale: 'Keeps cell edges readable against the ground.'
	},
	stageGridBoundaryStrokePx: {
		value: 2.5,
		unit: 'CSS px',
		meaning: 'Outer terrain grid stroke width',
		rationale: 'Distinguishes the perimeter from internal cell edges.'
	},
	stageGroundStrokePx: {
		value: 0.75,
		unit: 'CSS px',
		meaning: 'Width of the ground reference outline',
		rationale: 'Keeps the ground mark subordinate to the model.'
	},
	stageExplicitStrokePx: {
		value: 1,
		unit: 'CSS px',
		meaning: 'Base width for explicitly submitted line segments',
		rationale: 'Provides the starting width for explicit lines.'
	},
	stageStrokeDepthFloor: {
		value: 1e-3,
		unit: 'camera depth units',
		meaning: 'Minimum depth span used for stroke recession',
		rationale: 'Avoids division by a near-zero span.'
	},
	stageStrokePullPx: {
		value: 2.5,
		unit: 'CSS px',
		meaning: 'Maximum depth pull for pencil strokes at the current scale',
		rationale: 'Lifts strokes enough to clear their own surface.'
	},
	stageShadowOffsetM: {
		value: 0.002,
		unit: 'm',
		meaning: 'Vertical gap below the bounds for the stage shadow',
		rationale: 'Keeps the shadow from sharing the ground plane.'
	},
	stageGroundOutlineOffsetM: {
		value: 0.001,
		unit: 'm',
		meaning: 'Vertical gap below the bounds for the ground outline',
		rationale: 'Keeps the outline away from coincident faces.'
	},
	stageGroundOutlinePad: {
		value: 0.065,
		unit: 'ratio',
		meaning: 'Ground outline padding relative to the shorter bounds axis',
		rationale: 'Frames the ground without competing with the subject.'
	},
	stageGlassOpacity: {
		value: 0.7,
		unit: 'ratio',
		meaning: 'Fallback glass finish opacity in the WebGPU stage',
		rationale:
			'Preserves the renderer finish for glass without an authored opacity token. The CSS glass token is independently set to 0.6.'
	},
	stageFillDepthFactor: {
		value: 1,
		unit: 'depth slope factor',
		meaning: 'Stage fill polygon offset factor',
		rationale: 'Lets overlaid strokes win against the modeled surface.'
	},
	stageFillDepthBias: {
		value: 1,
		unit: 'depth units',
		meaning: 'Stage fill polygon offset units',
		rationale: 'Lets overlaid strokes win against the modeled surface.'
	},
	stageRoofNormalZ: {
		value: 0.7,
		unit: 'ratio',
		meaning: 'Minimum upward normal component for roof treatment',
		rationale: 'Keeps steep sloped walls in the wall tones.'
	},
	stageDarkFillLift: {
		value: 0.076,
		unit: 'Oklab lightness',
		meaning: 'Lightness added to pencil fills in the dark palette',
		rationale: 'Preserves separation from the dark background.'
	},
	stageSpeckPeriod: {
		value: 509,
		unit: 'cells',
		meaning: 'World grain repeat period along each axis',
		rationale: 'Keeps flattened hash inputs exact in Float32.'
	},
	stageHatchSpacingPx: {
		value: 5,
		unit: 'CSS px',
		meaning: 'Spacing of diagonal hatching strokes',
		rationale: 'Keeps the pencil treatment sparse at all zooms.'
	},
	stageHatchSoftEdgePx: {
		value: [0.3, 0.9],
		unit: 'CSS px',
		meaning: 'Inner and outer radii of a hatch stroke',
		rationale: 'Softens the line edges.'
	},
	stageHatchInkShare: {
		value: 0.55,
		unit: 'ratio',
		meaning: 'Maximum ink mix of shadow-side hatching',
		rationale: 'Lets the face color show through the hatch.'
	},
	stageBatchNormalScaleFloor: {
		value: 1e-4,
		unit: 'ratio',
		meaning: 'Smallest absolute vertical scale used in batch normal transforms',
		rationale: 'Avoids dividing normals by a near-zero scale.'
	},
	stageHiddenStrokeWidthRatio: {
		value: 0.75,
		unit: 'ratio',
		meaning: 'Hidden stroke width relative to its visible counterpart',
		rationale: 'Keeps covered strokes subordinate in both retained and individual rendering.'
	},
	stageGroundInkShare: {
		value: 0.48,
		unit: 'ratio',
		meaning: 'Ink mixed into the paper color for the ground outline',
		rationale: 'Makes the reference outline subdued in both themes.'
	},
	stageLandscapeCreasePaperShare: {
		value: [0.04, 0.13],
		unit: 'ratio',
		meaning: 'Paper share in landscape crease ink for light and dark themes',
		rationale: 'Keeps creases subordinate to the terrain silhouette.'
	},
	stageGroundShadowInkShare: {
		value: [0.32, 0.016],
		unit: 'ratio',
		meaning: 'Ink share of ground shadow for light and dark themes',
		rationale: 'Keeps cast shadows legible against each paper color.'
	},
	stagePaperTintInkShare: {
		value: [0.19, 0.09],
		unit: 'ratio',
		meaning: 'Ink share in the paper veil for light and dark themes',
		rationale: 'Keeps the veil visible without dominating the subject.'
	},
	stageSunXY: {
		value: [-0.6, -0.8],
		unit: 'unit vector',
		meaning: 'Horizontal light direction in stage XY axes',
		rationale: 'Keeps the same oblique light direction across object views.'
	},
	stageFlatFacingTolerance: {
		value: 1e-3,
		unit: 'ratio',
		meaning: 'Negative facing allowance for nearly horizontal lit roofs',
		rationale: 'Keeps level tops lit through numeric roundoff.'
	},
	stageShadowReachPerM: {
		value: 0.6,
		unit: 'm/m',
		meaning: 'Horizontal shadow reach per meter of height',
		rationale: 'Keeps shadows short enough to fit beside the model.'
	},
	stageFaceLightness: {
		value: [0.028, -0.055, -0.145],
		unit: 'Oklab lightness',
		meaning: 'Offsets for the top, lit wall and shaded wall',
		rationale: 'Gives objects three distinct face values.'
	},
	stageFaceGrain: {
		value: [0.014, 0.008, 0.026],
		unit: 'ratio',
		meaning: 'Graphite grain strengths for the top, lit wall and shaded wall',
		rationale: 'Gives each face a slightly different pencil pressure.'
	},
	stageGraphiteHashStride: {
		value: 4093,
		unit: 'hash cells',
		meaning: 'Stride used to flatten screen pixels for the graphite hash',
		rationale: 'Varies adjacent rows of pencil grain.'
	},
	stageExplicitFillOrder: {
		value: 4,
		unit: 'render order',
		meaning: 'Fill order for drawables with explicit strokes',
		rationale: 'Draws the modeled surface before its linework.'
	},
	stageDerivedStrokeBaseOrder: {
		value: 2,
		unit: 'render order',
		meaning: 'Base order for automatically derived stroke layers',
		rationale: 'Orders the outer, crease and grid layers consistently.'
	},
	stageExplicitStrokeOrder: {
		value: 5,
		unit: 'render order',
		meaning: 'Drawing order for explicit strokes',
		rationale: 'Places authored linework over its own fill.'
	},
	stageVeilOrder: {
		value: 6,
		unit: 'render order',
		meaning: 'Drawing order for the translucent front veil',
		rationale: 'Tints only the front layer after hidden strokes.'
	},
	stageShadowOrder: {
		value: -1,
		unit: 'render order',
		meaning: 'Drawing order of the ground shadow',
		rationale: 'Allows ground shade to sit below modeled objects.'
	}
});
