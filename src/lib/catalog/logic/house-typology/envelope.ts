import { shellSystems, type ShellSystem } from '../../data/house-shells';
import { membraneLoad } from './membrane';
import type { Membrane } from '../membrane';
import { sections } from './section-insets';
import { hashUnit } from '../../core/random';
import type { FinishId } from '../parametrik/types';

const skins = ['plain', 'woven', 'framed', 'cushioned'] as const;
const outlines = ['orthogonal', 'faceted', 'oval', 'fluted'] as const;
const finishes = [
	'beton-schalung',
	'membran-opal',
	'membran-gewebe',
	'holz-natur',
	'glas-matt',
	'metall-gebuerstet',
	'metall-lackiert',
	'keramik-glasiert'
] as const satisfies readonly FinishId[];

/** Independent choices for the inhabited section, its plan contour and its external finish. */
export type HouseEnvelope = {
	section: (typeof sections)[number];
	/** Requested roof rotation in radians relative to the anchored ground ring. */
	twist?: number;
	fabric?: Membrane;
	system: ShellSystem;
	outline: (typeof outlines)[number];
	finish: (typeof finishes)[number];
	skin: (typeof skins)[number];
};

function pick<T>(choices: readonly T[], seed: number, id: string, axis: string) {
	return choices[Math.floor(hashUnit(seed, id, axis) * choices.length)];
}

/** Resolves each omitted envelope axis from its own stable draw. */
export function houseEnvelope(
	id: string,
	seed: number,
	requested?: Partial<HouseEnvelope>
): HouseEnvelope {
	const system = requested?.system ?? pick(shellSystems, seed, id, 'perimeter/system');
	const fabric = membraneLoad(system, seed, id, requested?.fabric);
	const twist =
		requested?.twist ?? (fabric ? (hashUnit(seed, id, 'envelope/twist') - 0.5) * 1.3 : 0);
	if (!Number.isFinite(twist)) throw RangeError('Invalid envelope twist');
	return {
		system,
		fabric,
		twist,
		section: requested?.section ?? pick(sections, seed, id, 'perimeter/profile'),
		outline: requested?.outline ?? pick(outlines, seed, id, 'perimeter/outline'),
		skin: requested?.skin ?? pick(skins, seed, id, 'perimeter/skin'),
		finish: requested?.finish ?? pick(finishes, seed, id, 'perimeter/finish')
	};
}
