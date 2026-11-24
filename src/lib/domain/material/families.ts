import { materialSettings as m } from '../../../config/material';

/** How a family prints its face: one plain tone, black and white stripes across the body's long
 * axis, or a regular grid of dots over the two body axes that lie in the face. */
export type PatternKind = 'plain' | 'stripe' | 'dots';

/** Pattern parameters in meters before fitting to a body: the period, the printed share of it,
 * and the panel joint module along the body and up (zero for none). */
export type PatternParams = Readonly<{
	pitch: number;
	share: number;
	joint: readonly [number, number];
}>;

// Exact arithmetic: a plain face has no period and no joint.
const plain = { pitch: 0, share: 0, joint: [0, 0] as const };
// Exact arithmetic: no joint module along the body or up.
const noJoint = [0, 0] as const;

/** Every model material as data (MAT-3): the pattern it prints and its parameters. A family
 * knows nothing of houses, pages or colour; the palette paints its face and marks (MAT-1). */
export const families = Object.freeze({
	board: { pattern: 'plain', params: plain },
	card: { pattern: 'plain', params: { ...plain, joint: m.panelJointM } },
	cork: { pattern: 'plain', params: plain },
	stripe: {
		pattern: 'stripe',
		params: { pitch: m.stripePitchM, share: m.stripeShare, joint: noJoint }
	},
	perforated: {
		pattern: 'dots',
		params: { pitch: m.perforationPitchM, share: m.perforationShare, joint: noJoint }
	},
	acrylic: {
		pattern: 'dots',
		params: { pitch: m.lightDotPitchM, share: m.lightDotShare, joint: noJoint }
	},
	ground: { pattern: 'plain', params: plain }
} as const satisfies Record<string, { pattern: PatternKind; params: PatternParams }>);

/** A model material family. */
export type Family = keyof typeof families;
/** A role slot a family emits: the face in one tone and the printed marks of its pattern. */
export type FamilySlot = 'face' | 'mark';
/** Families in table order. */
export const familyNames = Object.freeze(Object.keys(families) as Family[]);

/** Reads a family's pattern, slots and default parameters. Throws RangeError for an unknown
 * family. */
export function readFamily(family: Family) {
	if (!Object.hasOwn(families, family)) throw new RangeError(`Unknown surface family "${family}"`);
	const { pattern, params } = families[family];
	const slots: readonly FamilySlot[] = pattern === 'plain' ? ['face'] : ['face', 'mark'];
	return { pattern, slots, params: params as PatternParams };
}
