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
	return {
		section: requested?.section ?? pick(sections, seed, id, 'perimeter/profile'),
		outline: requested?.outline ?? pick(outlines, seed, id, 'perimeter/outline'),
		skin: requested?.skin ?? pick(skins, seed, id, 'perimeter/skin'),
		finish: requested?.finish ?? pick(finishes, seed, id, 'perimeter/finish')
	};
}
