import { defineSettings } from '../setting';

const positive = { exclusiveMin: 0 } as const;

/** Triangle budgets and the coarsening applied when a patch would exceed them. */
export const budgets = defineSettings({
	patchTrianglesPerSquareM: {
		value: 60,
		unit: 'triangles/m²',
		meaning: 'Default budget density for a patch without an explicit budget',
		bounds: positive,
		principle: 'MAT-5'
	},
	minimumMeshTriangles: {
		value: 12,
		unit: 'triangles',
		meaning: 'Minimum patch budget for emitting a surface',
		bounds: positive,
		rationale: 'A rectangular closed slab has six faces with two triangles each.'
	},
	maxLayoutUnits: {
		value: 8192,
		unit: 'units',
		meaning: 'Maximum estimated pattern marks per layout attempt',
		bounds: positive,
		rationale: 'Bounds temporary allocations even when the triangle budget grows with patch area.'
	},
	coarsenStepRatio: {
		value: 1.25,
		unit: 'ratio',
		meaning: 'Pattern pitch growth per step when a patch exceeds its triangle budget',
		bounds: { exclusiveMin: 1 },
		rationale: 'Small enough to keep the look, large enough to converge in a few steps.'
	},
	coarsenStepLimit: {
		value: 12,
		unit: 'steps',
		meaning: 'Coarsening steps before the patch drops its pattern marks',
		bounds: { min: 1 },
		rationale: 'Twelve steps grow the module about fourteenfold.'
	},
	planeToleranceM: {
		value: 1e-6,
		unit: 'm',
		meaning: 'Patch-local grid for joining clipped side faces and minimum size of clipped edges',
		bounds: positive,
		rationale: 'Far below any joint, above float roundoff at city coordinates.'
	}
});
