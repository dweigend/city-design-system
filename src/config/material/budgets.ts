import { defineSettings } from '../setting';

const positive = { exclusiveMin: 0 } as const;

/** Triangle budgets and the coarsening applied when a patch would exceed them. */
export const budgets = defineSettings({
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
