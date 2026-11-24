import { materialSettings as m } from '../../../config/material';
import type { layouts, ReliefParams } from './layouts';

const none = [0, 0] as const;

/** Every surface family as data: its layout, the role slots it emits and its parameters from
 * the material configuration. A family knows nothing of houses, pages or colour. */
export const families = Object.freeze({
	render: {
		layout: 'bond',
		slots: ['unit', 'joint'],
		params: { module: m.renderModuleM, joint: m.renderJointM, relief: [m.renderReliefM], bond: m.renderBondShare, alt: m.renderAltShare, jitter: 0, crest: none }
	},
	masonry: {
		layout: 'bond',
		slots: ['unit', 'unit-alt', 'joint'],
		params: { module: m.masonryModuleM, joint: m.masonryJointM, relief: [m.masonryReliefM], bond: m.masonryBondShare, alt: m.masonryAltShare, jitter: m.reliefJitterShare, crest: none }
	},
	timber: {
		layout: 'boards',
		slots: ['unit', 'unit-alt', 'trim', 'joint'],
		params: { module: m.timberModuleM, joint: m.timberJointM, relief: m.timberReliefM, bond: 0, alt: m.timberAltShare, jitter: m.reliefJitterShare, crest: none }
	},
	metal: {
		layout: 'profile',
		slots: ['unit', 'joint'],
		params: { module: m.metalModuleM, joint: m.metalJointM, relief: [m.metalReliefM], bond: 0, alt: 0, jitter: 0, crest: m.metalCrestShare }
	},
	glass: {
		layout: 'grid',
		slots: ['unit', 'unit-alt', 'trim', 'joint'],
		params: { module: m.glassModuleM, joint: m.glassJointM, relief: m.glassReliefM, bond: 0, alt: m.glassAltShare, jitter: 0, crest: none }
	},
	paving: {
		layout: 'bond',
		ground: true,
		slots: ['unit', 'unit-alt', 'joint'],
		params: { module: m.pavingModuleM, joint: m.pavingJointM, relief: [m.pavingReliefM], bond: m.pavingBondShare, alt: m.pavingAltShare, jitter: m.reliefJitterShare, crest: none }
	}
} as const satisfies Record<string, { layout: keyof typeof layouts; ground?: boolean; slots: readonly string[]; params: ReliefParams }>);

/** A procedural surface family. */
export type Family = keyof typeof families;
/** A role slot a family emits: the module unit, its seeded variant, raised trim, and the joint
 * or backing behind the units, and the hard shade units cast when lit. */
export type FamilySlot = 'unit' | 'unit-alt' | 'trim' | 'joint' | 'shade';
/** Families in table order. */
export const familyNames = Object.freeze(Object.keys(families) as Family[]);

/** Reads a family's slots, layout, default parameters and whether it is laid on the ground. Throws RangeError for an unknown family. */
export function readFamily(family: Family) {
	if (!Object.hasOwn(families, family)) throw new RangeError(`Unknown surface family "${family}"`);
	const entry = families[family];
	const { layout, slots, params } = entry;
	const ground = 'ground' in entry && entry.ground;
	return { layout, ground, slots: [...slots, 'shade'] as readonly FamilySlot[], params: params as ReliefParams };
}
