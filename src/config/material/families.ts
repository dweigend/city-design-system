import { defineSettings } from '../setting';

const positive = { exclusiveMin: 0 } as const;
const share = { min: 0, max: 1 } as const;

/** Boards, sheet, glazing and shared relief settings. */
export const otherFamilies = defineSettings({
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
		value: [0.34, 0.12],
		unit: 'ratio',
		meaning: 'Crest width and each flank width as shares of the pitch; the rest is trough',
		bounds: share,
		rationale: 'Flanks steeper than the sun split into a lit and a shaded side on a lit wall.'
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
	shadeLiftM: {
		value: 0.002,
		unit: 'm',
		meaning: 'Offset of cast shade in front of the face it falls on',
		bounds: positive,
		rationale: 'Clears depth precision at plate and house distance.'
	},
	shadeLightness: {
		value: -0.17,
		unit: 'Oklab L',
		meaning: 'Lightness offset of cast shade from the face it falls on',
		bounds: { max: 0 },
		principle: 'MAT-2'
	},
	reliefJitterShare: {
		value: 0.25,
		unit: 'ratio',
		meaning: 'Seeded variation of each unit face depth as a share of its relief',
		bounds: share,
		rationale: 'Uneven faces give the crease lines a hand-drawn variety.'
	}
});
