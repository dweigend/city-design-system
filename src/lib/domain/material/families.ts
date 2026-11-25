import { materialSettings as m } from '../../../config/material';
import { createCatalog, type CatalogRow } from '../../core/catalog';

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

/** Caller-supplied pattern or parameter overrides for one build. The base family still
 * names the paint treatment. Omitted fields use that family's defaults. */
export type FamilyRecipe = Readonly<{ pattern?: PatternKind; params?: Partial<PatternParams> }>;

const patternKinds: ReadonlySet<PatternKind> = new Set(['plain', 'stripe', 'dots']);

// Exact arithmetic: a plain face has no period and no joint.
const plain = /* Exact arithmetic: plain faces have no pattern or joint. */ {
	pitch: 0,
	share: 0,
	joint: [0, 0] as const
};
// Exact arithmetic: no joint module along the body or up.
const noJoint = /* Exact arithmetic: no joint in either axis. */ [0, 0] as const;

/** Every model material as data (MAT-3): the pattern it prints and its parameters. A family
 * knows nothing of houses, pages or colour; the palette paints its face and marks (MAT-1). */
const families = createCatalog({
	rows: [
		{ id: 'board', pattern: 'plain', params: plain },
		{ id: 'card', pattern: 'plain', params: { ...plain, joint: m.panelJointM } },
		{ id: 'cork', pattern: 'plain', params: plain },
		{
			id: 'stripe',
			pattern: 'stripe',
			params: { pitch: m.stripePitchM, share: m.stripeShare, joint: noJoint }
		},
		{
			id: 'perforated',
			pattern: 'dots',
			params: { pitch: m.perforationPitchM, share: m.perforationShare, joint: noJoint }
		},
		{
			id: 'acrylic',
			pattern: 'dots',
			params: { pitch: m.lightDotPitchM, share: m.lightDotShare, joint: noJoint }
		},
		{ id: 'ground', pattern: 'plain', params: plain }
	] as const satisfies readonly (CatalogRow & { pattern: PatternKind; params: PatternParams })[],
	missingError: (id) => new RangeError(`Unknown surface family "${id}"`)
});

/** A model material family. */
export type Family = (typeof families.ids)[number];
/** A role slot a family emits: the face in one tone and the printed marks of its pattern. */
export type FamilySlot = 'face' | 'mark';
/** Families in table order. */
export const familyNames = families.ids;

function readRecipeParams(pattern: PatternKind, params: PatternParams) {
	const { pitch, share, joint } = params;
	if (
		!patternKinds.has(pattern) ||
		!Array.isArray(joint) ||
		joint.length !== 2 ||
		![pitch, share, ...joint].every(Number.isFinite) ||
		pitch < 0 ||
		share < 0 ||
		share > 1 ||
		joint.some((module) => module < 0) ||
		(pattern !== 'plain' && (pitch === 0 || share === 0))
	)
		throw new RangeError('Invalid surface pattern dimensions');
	return params;
}

/** Reads a family's pattern, slots and default parameters. Throws RangeError for an unknown
 * family. */
export function readFamily(family: Family, recipe?: FamilyRecipe) {
	const base = families.get(family);
	const pattern = recipe?.pattern ?? base.pattern;
	const {
		pitch = base.params.pitch,
		share = base.params.share,
		joint = base.params.joint
	} = recipe?.params ?? {};
	const params = recipe ? readRecipeParams(pattern, { pitch, share, joint }) : base.params;
	const slots: readonly FamilySlot[] = pattern === 'plain' ? ['face'] : ['face', 'mark'];
	return { pattern, slots, params };
}
