import { defineSettings, joinSettings, settingValues } from '../setting';

function setting<const V extends number | readonly number[]>(
	value: V,
	unit: string,
	meaning: string
) {
	return { value, unit, meaning, rationale: 'Preserves the established terrain grid calibration.' };
}

const base = defineSettings({
	outlineReachM: {
		value: 4000,
		unit: 'm',
		meaning: 'Default maximum outline distance from the datum',
		rationale: 'Preserves the supported extent of a terrain grid site.'
	},
	organicCellSizeM: setting(40, 'm', 'Default tile size of the organic carrier'),
	regularCellSizeM: setting(15, 'm', 'Default tile size of the other plan carriers'),
	minimumCellSizeM: setting(5, 'm', 'Smallest accepted tile size'),
	maximumCellSizeM: setting(120, 'm', 'Largest accepted tile size'),
	cellSizeStepM: setting(5, 'm', 'Parameter step for tile size'),
	quadCellSideRatio: setting(
		0.927,
		'ratio',
		'Mean equivalent square side per unit tile size for organic and free-quad carriers'
	),
	hexCellSideRatio: setting(
		1.612,
		'ratio',
		'Mean equivalent square side per unit tile size for the hex carrier'
	),
	triangleCellSideRatio: setting(
		0.658,
		'ratio',
		'Mean equivalent square side per unit tile size for the triangle carrier'
	),
	maximumSampleSubdivisions: setting(
		512,
		'count',
		'Maximum terrain probes along one edge or chord'
	),
	minimumPlanAngleRad: setting(Math.PI / 6, 'rad', 'Smallest accepted plan angle'),
	maximumPlanEdgeRatio: setting(
		2.4,
		'ratio',
		'Largest longest-to-shortest edge ratio accepted for a relaxed plan cell'
	),
	maximumPlanGradeRatio: setting(0.2, 'ratio', 'Default maximum rise per meter of horizontal run'),
	maximumPlanSampleStepM: setting(1, 'm', 'Default maximum distance between sampled points'),
	organicCenterWeight: setting(0.76, 'ratio', 'Center weight of the organic lattice jitter field'),
	organicNeighborWeight: setting(
		0.04,
		'ratio',
		'Weight of each neighboring organic lattice jitter sample'
	),
	organicJitterRatio: setting(
		0.13,
		'ratio',
		'Maximum seeded organic lattice offset in cell widths'
	),
	organicRowScaleRatio: setting(0.94, 'ratio', 'Vertical scale of the organic lattice'),
	organicSpacingRatio: setting(2.25, 'ratio', 'Organic parent-cell spacing per unit tile size'),
	organicPaddingCount: setting(2, 'count', 'Extra parent cells around the organic carrier search'),
	outlineToleranceM: setting(1e-8, 'm', 'Rounding tolerance in outline validation'),
	datumCoordinateLimitM: setting(1e9, 'm', 'Largest accepted absolute terrain datum coordinate'),
	contourProbeOffsetM: setting(
		10,
		'm',
		'Offset to each side of the datum when sampling the terrain gradient'
	),
	contourMinimumSlopeRatio: setting(
		0.015,
		'ratio',
		'Minimum terrain slope used to set the contour bearing'
	),
	regularPaddingCount: setting(3, 'count', 'Extra cells around the regular carrier search'),
	bandPeriodRatio: setting(3, 'ratio', 'Length of one band cycle in cell widths'),
	bandBreaksRatio: setting([0, 0.7, 2], 'ratio', 'Break positions in a band cycle in cell widths'),
	contourAmplitudeRatio: setting(1.2, 'ratio', 'Contour displacement amplitude in cell widths'),
	contourGradientScaleRatio: setting(
		7,
		'ratio',
		'Contour sine argument distance scale in cell widths'
	),
	polarSectorCount: setting(16, 'count', 'Angular sectors around a polar grid ring'),
	voronoiMinimumEdgeRatio: setting(
		0.125,
		'ratio',
		'Shortest edge retained in a clipped Voronoi cell'
	),
	voronoiJitterRatio: setting(0.22, 'ratio', 'Maximum seeded Voronoi site offset in cell widths'),
	voronoiBisectorPrecision: setting(
		1e8,
		'count',
		'Resolution of bisector coordinates used in Voronoi address keys'
	),
	voronoiSearchRadius: setting(2, 'count', 'Neighborhood radius for Voronoi carrier candidates')
});

export const defaults = settingValues(base);

const shoreline = defineSettings({
	bandM: {
		value: 155,
		unit: 'm',
		meaning: 'Distance from the setback at which the displacement field reaches zero',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	minimumWaterWidthM: {
		value: 24,
		unit: 'm',
		meaning: 'Minimum width across water for a bank to be eligible for alignment',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	bankToleranceM: {
		value: 8,
		unit: 'm',
		meaning: 'Maximum distance from the setback for an edge to count as aligned',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	bankAllowanceM: {
		value: 4.5,
		unit: 'm',
		meaning: 'Dry-side offset from the setback, leaving room for a chord to cut a curved bank',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	maximumMoveM: {
		value: 85,
		unit: 'm',
		meaning: 'Maximum total displacement of a bank node',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	minimumAreaRatio: {
		value: 0.32,
		unit: 'ratio',
		meaning: 'Smallest retained area relative to the unmodified cell',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	maximumAreaRatio: {
		value: 2.2,
		unit: 'ratio',
		meaning: 'Largest retained area relative to the unmodified cell',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	minimumAngleRad: {
		value: Math.PI / 12,
		unit: 'rad',
		meaning: 'Smallest interior angle unless the original was already smaller',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	maximumEdgeRatio: {
		value: 5,
		unit: 'ratio',
		meaning: 'Largest longest-to-shortest edge ratio unless the original was already larger',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	gradientProbeM: {
		value: 4,
		unit: 'm',
		meaning: 'Symmetric probe distance for estimating the direction to the bank',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	minimumGradientRatio: {
		value: 0.35,
		unit: 'ratio',
		meaning: 'Minimum estimated clearance gradient magnitude for projection',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	projectionPassCount: {
		value: 5,
		unit: 'count',
		meaning: 'Iteration budget for solving the setback contour',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	projectionToleranceM: {
		value: 0.08,
		unit: 'm',
		meaning: 'Residual clearance at which projection stops',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	projectionFallbackToleranceM: {
		value: 0.5,
		unit: 'm',
		meaning: 'Largest residual clearance accepted when the projection budget runs out',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	tangentRelaxationRatio: {
		value: 0.8,
		unit: 'ratio',
		meaning: 'Tangential correction toward the mean of the two rail neighbors',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	widthProbeDepthRatio: {
		value: 0.2,
		unit: 'ratio',
		meaning: 'Required depth at the midpoint of the width probe, as a share of its length',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	diffusionPassCount: {
		value: 14,
		unit: 'count',
		meaning: 'Passes for diffusing bank displacement through neighboring nodes',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	diffusionRetentionRatio: {
		value: 0.98,
		unit: 'ratio',
		meaning: 'Neighbor displacement retained by each diffusion pass before the distance fade',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	guardPassCount: {
		value: 15,
		unit: 'count',
		meaning: 'Passes allowed to gradually reduce a rejected displacement before dropping it',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	anchorRecoveryPassCount: {
		value: 6,
		unit: 'count',
		meaning: 'Attempts to recover an anchor after the surrounding cells pass the guard',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	guardRetentionRatio: {
		value: 0.78,
		unit: 'ratio',
		meaning: 'Displacement retained after a cell fails a guard check',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	guardAngleToleranceRad: {
		value: 1e-10,
		unit: 'rad',
		meaning: 'Rounding allowance in the interior angle comparison',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	guardEdgeToleranceM: {
		value: 1e-9,
		unit: 'm',
		meaning: 'Rounding allowance in the edge length comparison',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	clippedMinimumAreaRatio: {
		value: 0.24,
		unit: 'ratio',
		meaning: 'Smallest accepted area of a clipped cell relative to its nominal area',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	clippedMinimumEdgeRatio: {
		value: 0.1,
		unit: 'ratio',
		meaning: 'Shortest edge of a clipped cell relative to the nominal cell side',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	clippedMinimumAngleRad: {
		value: Math.PI / 12,
		unit: 'rad',
		meaning: 'Smallest interior angle of a clipped cell',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	clippedMaximumAspectRatio: {
		value: 6,
		unit: 'ratio',
		meaning: 'Largest squared diameter divided by area of a clipped cell',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	clipToleranceM: {
		value: 0.05,
		unit: 'm',
		meaning: "Precision of a shared edge's intersection with the setback",
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	clearanceSampleStepM: {
		value: 0.25,
		unit: 'm',
		meaning: 'Smallest interval probed when a segment grazes the setback',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	targetUnclippedShare: {
		value: 0.5,
		unit: 'ratio',
		meaning: 'Study target for the share of occupied shore cells that keep all their plan nodes',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	},
	targetAlignedEdgeShare: {
		value: 0.5,
		unit: 'ratio',
		meaning: 'Study target for the share of bank edges within the setback tolerance',
		rationale: 'Keeps the established shoreline fitting and quality defaults.'
	}
});

export const settings = joinSettings(base, shoreline);
export const shorelineMorphLimits = settingValues(shoreline);
