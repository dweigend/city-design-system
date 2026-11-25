import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	valleyTriangleBudget: {
		value: 36_000,
		unit: 'triangles',
		meaning: 'Maximum triangle count including terrain, water and cut sides',
		rationale: 'Bounds the draw cost of a landscape view.'
	},
	valleyStripWidthM: {
		value: 4000,
		unit: 'm',
		meaning: 'Width of the projected regional valley strip',
		rationale: 'Shows the valley floor and both slopes.'
	},
	valleyLowlandScale: {
		value: 14,
		unit: 'ratio',
		meaning: 'Maximum vertical exaggeration of a lowland valley',
		rationale: 'Makes low relief legible at regional scale.'
	},
	valleyScaleReferenceReliefM: {
		value: 38,
		unit: 'm',
		meaning: 'Relief at which automatic vertical scale begins to diminish',
		rationale: 'Keeps the higher terrain inside the view.'
	},
	valleyScaleStepsPerUnit: {
		value: 10,
		unit: 'steps/ratio',
		meaning: 'Resolution of automatic vertical scale',
		rationale: 'Rounds the displayed scale to tenths.'
	},
	valleyTributaryStrokePx: {
		value: 2.2,
		unit: 'CSS px',
		meaning: 'Width of tributary strokes',
		rationale: 'Keeps narrow side channels visible in the region.'
	},
	valleyContourStepsM: {
		value: [1, 2.5, 5, 10],
		unit: 'm',
		meaning: 'Candidate contour field steps, from fine to coarse',
		rationale: 'Keeps shallow terrain readable while limiting crowding on slopes.'
	},
	valleyContourFieldLimit: {
		value: 75,
		unit: 'contours',
		meaning: 'Target count of minor contours across the relief',
		rationale: 'Chooses a coarser sampling step as relief grows.'
	},
	valleyContourFieldStride: {
		value: 2,
		unit: 'field steps',
		meaning: 'Minor contour interval used when choosing a valley contour field step',
		rationale: 'Matches the stage pencil contour spacing for the valley field.'
	},
	waterUnionBucketM: {
		value: 150,
		unit: 'm',
		meaning: 'Water union bucket side length',
		rationale: 'Limits each polygon to local overlap candidates.'
	},
	waterUnionAreaEpsilonM2: {
		value: 1e-8,
		unit: 'm²',
		meaning: 'Minimum plan area of a water union fragment',
		rationale: 'Discards floating-point slivers.'
	},
	waterSeamToleranceM: {
		value: 1e-7,
		unit: 'm',
		meaning: 'Seam matching tolerance at shared water edges',
		rationale: 'Absorbs roundoff when joining neighboring fragments.'
	},
	valleySectionEdgeToleranceM: {
		value: 1e-9,
		unit: 'm',
		meaning: 'Longitudinal tolerance when a section intersects a facet edge',
		rationale: 'Includes shared-edge intersections through roundoff.'
	},
	valleySectionSpanToleranceM: {
		value: 1e-5,
		unit: 'm',
		meaning: 'Minimum transverse span and minimum gap between spans in a water section',
		rationale: 'Discards near-zero spans and joins nearly adjacent water surfaces.'
	},
	valleySectionMinSubdivisions: {
		value: 2,
		unit: 'segments',
		meaning: 'Minimum subdivisions through one wet cross section',
		rationale: 'Keeps an interior sample in narrow channels.'
	},
	valleySectionMaxSubdivisions: {
		value: 12,
		unit: 'segments',
		meaning: 'Maximum subdivisions through one wet cross section',
		rationale: 'Limits detail in wide water surfaces.'
	},
	valleySectionTargetStepM: {
		value: 35,
		unit: 'm',
		meaning: 'Target interval between samples across water',
		rationale: 'Resolves broad channels at the landscape scale.'
	},
	valleyBankCrossingMergeM: {
		value: 0.03,
		unit: 'm',
		meaning: 'Minimum separation between a regular sample and an inserted bank crossing',
		rationale: 'Avoids nearly coincident ground vertices.'
	},
	valleySubmergedGroundGapM: {
		value: 0.015,
		unit: 'm',
		meaning: 'Minimum height gap below water for submerged ground',
		rationale: 'Prevents water and terrain from drawing at the same depth.'
	},
	valleyJoinSpanFactor: {
		value: 1.5,
		unit: 'ratio',
		meaning: 'Reach factor for matching wet spans between sample rows',
		rationale: 'Allows a bend to move a channel laterally between adjacent rows.'
	},
	valleyJoinSpanPaddingM: {
		value: 12,
		unit: 'm',
		meaning: 'Additional reach for matching spans in adjacent rows',
		rationale: 'Allows a modest offset on closely spaced rows.'
	},
	valleyBoundaryVertexToleranceM: {
		value: 1e-7,
		unit: 'm',
		meaning: 'Tolerance for water vertices at the outer cut boundary',
		rationale: 'Includes water intersections despite clipping roundoff.'
	},
	valleyRowMergeSpacingM: {
		value: 0.15,
		unit: 'm',
		meaning: 'Minimum gap between adjacent inserted cross sections',
		rationale: 'Keeps the row triangulation from producing near-zero spans.'
	},
	valleyAcrossMinSegments: {
		value: 32,
		unit: 'segments',
		meaning: 'Minimum terrain divisions across the window',
		rationale: 'Keeps narrow windows sampled.'
	},
	valleyAcrossMaxSegments: {
		value: 136,
		unit: 'segments',
		meaning: 'Maximum terrain divisions across the window',
		rationale: 'Caps mesh density for wide windows.'
	},
	valleyAcrossTargetStepM: {
		value: 58,
		unit: 'm',
		meaning: 'Target transverse terrain sampling step before grading',
		rationale: 'Balances regular terrain detail against the mesh budget.'
	},
	valleyAlongMinSegments: {
		value: 26,
		unit: 'segments',
		meaning: 'Minimum terrain divisions along the reach',
		rationale: 'Keeps the longitudinal terrain readable.'
	},
	valleyAlongMaxSegments: {
		value: 75,
		unit: 'segments',
		meaning: 'Maximum terrain divisions along the reach',
		rationale: 'Leaves mesh budget for wet sections and sidewalls.'
	},
	valleyMeshReserveTriangles: {
		value: 3200,
		unit: 'triangles',
		meaning: 'Reserved budget outside the regular ground grid',
		rationale: 'Leaves space for sidewalls and uneven cuts.'
	},
	valleyAlongReserveRows: {
		value: 14,
		unit: 'rows',
		meaning: 'Longitudinal reserve for added section rows',
		rationale: 'Allows shoreline rows to be inserted without exceeding the triangle budget.'
	},
	valleySkirtDepthM: {
		value: 7,
		unit: 'm',
		meaning: 'Unscaled depth below the lowest terrain point',
		rationale: 'Keeps the cut earth sides visible below the lowest facet.'
	},
	valleyRasterStepM: {
		value: 20,
		unit: 'm',
		meaning: 'Target sample interval of the shaded terrain field',
		rationale: 'Retains contour detail independently from the triangle mesh.'
	},
	valleyRasterBankLimitM: {
		value: 160,
		unit: 'm',
		meaning: 'Magnitude limit of the signed bank-distance field',
		rationale: 'Keeps the field range local to visibly shaded banks.'
	},
	valleyRasterGradientReachSamples: {
		value: 2,
		unit: 'samples',
		meaning: 'Cross-axis reach used to smooth each sampled gradient',
		rationale: 'Avoids emphasizing individual solve-grid diagonals.'
	},
	valleySlopeSampleStepM: {
		value: 10,
		unit: 'm',
		meaning: 'Maximum integration interval for slope-weighted spacing',
		rationale: 'Resolves the slope transitions that draw denser samples.'
	},
	valleySlopeDensityGain: {
		value: 7,
		unit: 'ratio',
		meaning: 'Maximum extra sampling density on steep slopes',
		rationale: 'Concentrates extra triangles near the banks and steep terrain.'
	},
	valleySlopeDensityStart: {
		value: 0.023,
		unit: 'm/m',
		meaning: 'Slope where extra mesh density begins',
		rationale: 'Leaves flat ground sparsely sampled.'
	},
	valleySlopeDensityRange: {
		value: 0.079,
		unit: 'm/m',
		meaning: 'Slope increase over which density reaches its maximum',
		rationale: 'Introduces denser sampling gradually.'
	},
	valleyTributaryBucketsM: {
		value: 64,
		unit: 'm',
		meaning: 'Bucket side length for draping tributaries over terrain',
		rationale: 'Limits drape queries to nearby facets.'
	},
	valleyTributaryMinSpanM: {
		value: 1e-8,
		unit: 'm',
		meaning: 'Minimum clipped tributary segment length',
		rationale: 'Drops fragments that collapse at the window boundary.'
	},
	valleyTributaryLiftM: {
		value: 0.15,
		unit: 'm',
		meaning: 'Unscaled lift for a projected tributary stroke',
		rationale: 'Keeps the tributary visible above water and ground.'
	},
	valleyWaterWeldPerM: {
		value: 1e6,
		unit: 'grid intervals/m',
		meaning: 'Resolution of the water vertex welding grid',
		rationale: 'Keeps adjoining polygons connected after clipping.'
	},
	valleyWaterTriangleArea2ToleranceM2: {
		value: 1e-8,
		unit: 'm²',
		meaning: 'Minimum doubled area of a triangulated water face',
		rationale: 'Skips degenerate triangles independently of polygon union.'
	}
});

export const defaults = settingValues(settings);
