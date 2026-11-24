import { defineSettings, joinSettings, settingValues } from '../setting';

const positive = { exclusiveMin: 0 } as const;
const share = { min: 0, max: 1 } as const;

/** Module, joint and relief of each surface family. Bands are [across, up] in patch meters.
 * Relief is stylised: deeper than built practice, so a joint reads at sample and house distance. */
const families = defineSettings({
	renderModuleM: {
		value: [1.8, 0.6],
		unit: 'm',
		meaning: 'Width and height of one scored render panel',
		bounds: positive,
		principle: 'MAT-3'
	},
	renderJointM: {
		value: 0.035,
		unit: 'm',
		meaning: 'Width of the scored groove between render panels',
		bounds: positive,
		principle: 'MAT-3'
	},
	renderReliefM: {
		value: 0.03,
		unit: 'm',
		meaning: 'Depth of the render panels above the groove',
		bounds: positive,
		principle: 'MAT-3'
	},
	renderBondShare: {
		value: 0.5,
		unit: 'ratio',
		meaning: 'Offset of every second render course as a share of the panel width',
		bounds: share,
		rationale: 'Half-bond ashlar scoring, the classic rusticated render.'
	},
	renderAltShare: {
		value: 0,
		unit: 'ratio',
		meaning: 'Share of render panels in the variant tone',
		bounds: share,
		rationale: 'Render is one even coat; variation would read as patching.'
	},
	masonryModuleM: {
		value: [0.42, 0.18],
		unit: 'm',
		meaning: 'Length and height of one masonry block including its joint',
		bounds: positive,
		principle: 'MAT-3'
	},
	masonryJointM: {
		value: 0.03,
		unit: 'm',
		meaning: 'Mortar joint width',
		bounds: positive,
		principle: 'MAT-3'
	},
	masonryReliefM: {
		value: 0.035,
		unit: 'm',
		meaning: 'Depth of a block face above its raked joint',
		bounds: positive,
		principle: 'MAT-3'
	},
	masonryBondShare: {
		value: 0.5,
		unit: 'ratio',
		meaning: 'Running-bond offset of every second course as a share of the block length',
		bounds: share,
		rationale: 'Stretcher bond, the most common wall bond.'
	},
	masonryAltShare: {
		value: 0.22,
		unit: 'ratio',
		meaning: 'Share of blocks drawn in the variant tone',
		bounds: share,
		rationale: 'Enough to break the grid without reading as a pattern.'
	},
	timberModuleM: {
		value: [0.24, 3],
		unit: 'm',
		meaning: 'Board width and board length of vertical boarding',
		bounds: positive,
		principle: 'MAT-3'
	},
	timberJointM: {
		value: 0.05,
		unit: 'm',
		meaning: 'Width of the batten that covers each board joint',
		bounds: positive,
		principle: 'MAT-3'
	},
	timberReliefM: {
		value: [0.025, 0.06],
		unit: 'm',
		meaning: 'Board face and batten face above the backing',
		bounds: positive,
		principle: 'MAT-3'
	},
	timberAltShare: {
		value: 0.25,
		unit: 'ratio',
		meaning: 'Share of boards drawn in the variant tone',
		bounds: share,
		rationale: 'Boards weather unevenly; a quarter keeps the rhythm visible.'
	},
	metalModuleM: {
		value: [0.3, 2.4],
		unit: 'm',
		meaning: 'Corrugation pitch and sheet length between lap seams',
		bounds: positive,
		principle: 'MAT-3'
	},
	metalJointM: {
		value: 0.02,
		unit: 'm',
		meaning: 'Height of the lap step where two sheets overlap',
		bounds: positive,
		principle: 'MAT-3'
	},
	metalReliefM: {
		value: 0.06,
		unit: 'm',
		meaning: 'Depth of the trapezoid corrugation',
		bounds: positive,
		principle: 'MAT-3'
	},
	metalCrestShare: {
		value: [0.3, 0.2],
		unit: 'ratio',
		meaning: 'Crest width and each flank width as shares of the pitch; the rest is trough',
		bounds: share,
		rationale: 'A trapezoid profile whose flanks catch light and shade.'
	},
	glassModuleM: {
		value: [1.2, 1.5],
		unit: 'm',
		meaning: 'Width and height of one pane between mullions',
		bounds: positive,
		principle: 'MAT-3'
	},
	glassJointM: {
		value: 0.08,
		unit: 'm',
		meaning: 'Face width of a mullion or transom',
		bounds: positive,
		principle: 'MAT-4'
	},
	glassReliefM: {
		value: [0.012, 0.09],
		unit: 'm',
		meaning: 'Pane face and mullion face above the backing',
		bounds: positive,
		principle: 'MAT-4'
	},
	glassAltShare: {
		value: 0.2,
		unit: 'ratio',
		meaning: 'Share of panes drawn in the darker variant, as if open or shaded',
		bounds: share,
		rationale: 'A few dark panes give a curtain wall depth without reflections.'
	},
	pavingModuleM: {
		value: [0.3, 0.2],
		unit: 'm',
		meaning: 'Length and width of one paving sett including its joint',
		bounds: positive,
		principle: 'MAT-3'
	},
	pavingJointM: {
		value: 0.025,
		unit: 'm',
		meaning: 'Sand joint between setts',
		bounds: positive,
		principle: 'MAT-3'
	},
	pavingReliefM: {
		value: 0.03,
		unit: 'm',
		meaning: 'Height of a sett above its joint',
		bounds: positive,
		principle: 'MAT-3'
	},
	pavingBondShare: {
		value: 0.5,
		unit: 'ratio',
		meaning: 'Offset of every second row of setts as a share of the sett length',
		bounds: share,
		rationale: 'Running bond keeps joints from forming long lines.'
	},
	pavingAltShare: {
		value: 0.3,
		unit: 'ratio',
		meaning: 'Share of setts drawn in the variant tone',
		bounds: share,
		rationale: 'Mixed stone batches, a common paving look.'
	},
	reliefJitterShare: {
		value: 0.25,
		unit: 'ratio',
		meaning: 'Seeded variation of each unit face depth as a share of its relief',
		bounds: share,
		rationale: 'Uneven faces give the crease lines a hand-drawn variety.'
	}
});

/** Triangle budgets and the coarsening applied when a patch would exceed them. */
const budgets = defineSettings({
	plateTriangleBudget: {
		value: 6000,
		unit: 'triangles',
		meaning: 'Most triangles one 2 x 2 m sample plate may use',
		bounds: positive,
		principle: 'MAT-5'
	},
	patchTrianglesPerSquareM: {
		value: 450,
		unit: 'triangles/m²',
		meaning: 'Default budget density for a patch without an explicit budget',
		bounds: positive,
		principle: 'MAT-5'
	},
	bodyTriangleBudget: {
		value: 60000,
		unit: 'triangles',
		meaning: 'Most triangles one sample body with roof, openings and ground may use',
		bounds: positive,
		principle: 'MAT-5'
	},
	coarsenStepRatio: {
		value: 1.25,
		unit: 'ratio',
		meaning: 'Module growth per step when a patch exceeds its triangle budget',
		bounds: { exclusiveMin: 1 },
		rationale: 'Small enough to keep the look, large enough to converge in a few steps.'
	},
	coarsenStepLimit: {
		value: 12,
		unit: 'steps',
		meaning: 'Coarsening steps before the patch falls back to the flat level',
		bounds: { min: 1 },
		rationale: 'Twelve steps grow the module about fourteenfold.'
	},
	faceWeldM: {
		value: 1e-4,
		unit: 'm',
		meaning: 'Grid on which two side faces count as the same face',
		bounds: positive,
		rationale: 'Matches the stage edge weld, so a hidden face pair never draws a crease.'
	},
	planeToleranceM: {
		value: 1e-6,
		unit: 'm',
		meaning: 'Distance below which a clipped edge or face counts as degenerate',
		bounds: positive,
		rationale: 'Far below any joint, above float roundoff at city coordinates.'
	}
});

/** Sample plates and the sample body shown on the surfaces page. */
const samples = defineSettings({
	plateSizeM: {
		value: [2, 2],
		unit: 'm',
		meaning: 'Width and height of one sample plate',
		bounds: positive,
		rationale: 'Large enough for several modules of every family.'
	},
	plateThicknessM: {
		value: 0.12,
		unit: 'm',
		meaning: 'Thickness of a sample plate behind its relief',
		bounds: positive,
		rationale: 'Reads as a physical slab in iso.'
	},
	plateGapM: {
		value: [0.9, 2.6],
		unit: 'm',
		meaning: 'Gap between plates in a row and depth step between rows',
		bounds: positive,
		rationale: 'Keeps the cast shadow of one plate off the next.'
	},
	plateStandM: {
		value: [0.35, 0.5, 0.6],
		unit: 'm',
		meaning: 'Height of the front stand, extra height of each further tier and stand depth',
		bounds: positive,
		rationale: 'Each tier rises so the back plates show above the front ones.'
	},
	plateColumns: {
		value: 3,
		unit: 'plates',
		meaning: 'Plates per row of the sample board',
		bounds: { min: 1 },
		rationale: 'Three columns keep each plate large on a wide canvas.'
	},
	bodySizeM: {
		value: [8, 6, 4.6, 7],
		unit: 'm',
		meaning: 'Width, depth, eaves height and ridge height of the sample body',
		bounds: positive,
		rationale: 'A small two-storey house with a gable.'
	},
	bodyWallM: {
		value: 0.3,
		unit: 'm',
		meaning: 'Wall thickness of the sample body',
		bounds: positive,
		rationale: 'A plain solid wall; the opening reveal shows it.'
	},
	bodyEaveM: {
		value: 0.35,
		unit: 'm',
		meaning: 'Roof overhang beyond the walls',
		bounds: positive,
		rationale: 'A visible eave line separates roof and wall.'
	},
	bodyDoorM: {
		value: [1.2, 2.3, 1.6],
		unit: 'm',
		meaning: 'Door width, height and offset of its left jamb from the front wall corner',
		bounds: { min: 0 },
		rationale: 'One storey-high opening on the front.'
	},
	bodyWindowM: {
		value: [1.8, 1.4, 4.6, 0.9],
		unit: 'm',
		meaning: 'Window width, height, offset from the wall corner and sill height',
		bounds: { min: 0 },
		rationale: 'One wide window beside the door, repeated on the side wall.'
	},
	bodyOpeningInsetM: {
		value: 0.15,
		unit: 'm',
		meaning: 'Depth of the glazing behind the outer wall face',
		bounds: positive,
		rationale: 'Half the wall, so the reveal reads on two sides.'
	},
	bodyGlazingM: {
		value: 0.04,
		unit: 'm',
		meaning: 'Thickness of the dark backing behind the glazing in an opening',
		bounds: positive,
		rationale: 'Thin enough to sit inside the reveal.'
	},
	bodyGroundM: {
		value: [3, 0.12],
		unit: 'm',
		meaning: 'Ground margin around the body and ground slab thickness',
		bounds: positive,
		rationale: 'Shows the ground contact and the cast shadow.'
	},
	moduleScaleBand: {
		value: [0.5, 2, 0.25],
		unit: 'ratio',
		meaning: 'Lowest, highest and step of the module scale a player may choose',
		bounds: positive,
		rationale: 'From half to double the configured module keeps every family recognisable.'
	},
	reliefScaleBand: {
		value: [0, 2, 0.25],
		unit: 'ratio',
		meaning: 'Lowest, highest and step of the relief scale a player may choose',
		bounds: { min: 0 },
		rationale: 'Zero flattens the relief; double shows it at long distance.'
	},
	seedBand: {
		value: [1, 64, 1],
		unit: 'seed',
		meaning: 'Lowest, highest and step of the variation seed offered on the page',
		bounds: { min: 0 },
		rationale: 'A short range is enough to compare variations.'
	},
	pencilHatchRatio: {
		value: 0.6,
		unit: 'ratio',
		meaning: 'Hatching strength on shaded faces at the pencil level',
		bounds: share,
		principle: 'COLOR-5'
	},
	pencilStrokeWidthPx: {
		value: 0.8,
		unit: 'CSS px',
		meaning: 'Width of the joint lines drawn at the pencil level',
		bounds: positive,
		principle: 'MAT-6'
	},
	pencilStrokeOpacityRatio: {
		value: 0.55,
		unit: 'ratio',
		meaning: 'Opacity of the joint lines drawn at the pencil level',
		bounds: share,
		principle: 'MAT-6'
	},
	pencilLiftM: {
		value: 0.004,
		unit: 'm',
		meaning: 'Offset of pencil joint lines in front of the flat face',
		bounds: positive,
		rationale: 'Keeps the lines from flickering into the face they sit on.'
	}
});

/** Numeric settings and their provenance. */
export const settings = joinSettings(families, budgets, samples);

/** Frozen defaults consumed by scene/material. */
export const materialSettings = settingValues(settings);
