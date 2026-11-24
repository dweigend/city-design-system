import { defineSettings } from '../setting';

const positive = { exclusiveMin: 0 } as const;
const share = { min: 0, max: 1 } as const;

/** Module, joint and relief of each surface family. Bands are [across, up] in patch meters.
 * Relief is stylised: deeper than built practice, so a joint reads at sample and house distance. */
export const bondFamilies = defineSettings({
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
	}
});
