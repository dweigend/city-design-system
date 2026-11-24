import { defineSettings } from '../setting';

const positive = { exclusiveMin: 0 } as const;
const share = { exclusiveMin: 0, max: 1 } as const;

/** Pitch and size of the graphic patterns and the panel joints of the model materials. A pitch is
 * fitted to whole periods over the body it wraps, so every body edge is a period boundary. */
export const patterns = defineSettings({
	stripePitchM: {
		value: 0.6,
		unit: 'm',
		meaning: 'One black and one white stripe of the stripe laminate, across the stripes',
		bounds: positive,
		principle: 'MAT-9'
	},
	stripeShare: {
		value: 0.5,
		unit: 'ratio',
		meaning: 'Share of a stripe period printed dark',
		bounds: share,
		principle: 'MAT-8'
	},
	perforationPitchM: {
		value: 0.36,
		unit: 'm',
		meaning: 'Grid pitch of the holes of the perforated sheet',
		bounds: positive,
		principle: 'MAT-8'
	},
	perforationShare: {
		value: 0.42,
		unit: 'ratio',
		meaning: 'Hole diameter of the perforated sheet as a share of its pitch',
		bounds: share,
		principle: 'MAT-8'
	},
	lightDotPitchM: {
		value: 0.75,
		unit: 'm',
		meaning: 'Grid pitch of the light dots behind translucent acrylic',
		bounds: positive,
		principle: 'MAT-14'
	},
	lightDotShare: {
		value: 0.6,
		unit: 'ratio',
		meaning: 'Light dot diameter as a share of its pitch',
		bounds: share,
		principle: 'MAT-14'
	},
	dotSides: {
		value: 8,
		unit: 'corners',
		meaning: 'Corners of the polygon that draws one dot',
		bounds: { min: 4 },
		rationale: 'Eight corners read round at house distance and cost six triangles per dot.'
	},
	panelJointM: {
		value: [2.4, 2.4],
		unit: 'm',
		meaning: 'Sheet module of grey board along the body and up, drawn as hairline joints',
		bounds: positive,
		principle: 'MAT-12'
	},
	markLiftM: {
		value: 0.006,
		unit: 'm',
		meaning: 'Offset of printed pattern marks and joint lines in front of the face they sit on',
		bounds: positive,
		rationale: 'Clears depth precision at plate and house distance without a visible step.'
	},
	farMarkPitchM: {
		value: 0.5,
		unit: 'm',
		meaning: 'Smallest pattern pitch still printed at the far level',
		bounds: positive,
		principle: 'MAT-5'
	}
});
