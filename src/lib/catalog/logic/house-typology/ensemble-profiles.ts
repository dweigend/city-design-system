import { hashUnit } from '../../core/random';
import type { HouseEnvelope } from './envelope';

type Profile = Pick<HouseEnvelope, 'section' | 'outline'>;
const profiles: Profile[] = [
	{ section: 'buttressed-spire', outline: 'faceted' },
	{ section: 'barrel', outline: 'orthogonal' },
	{ section: 'vessel', outline: 'oval' },
	{ section: 'diagonal-sail', outline: 'faceted' },
	{ section: 'barrel', outline: 'oval' },
	{ section: 'longhouse', outline: 'oval' },
	{ section: 'tiered-ziggurat', outline: 'orthogonal' },
	{ section: 'orbital-nodes', outline: 'oval' }
];

/** Deals distinct section and contour pairs to the stable site order, three families per cycle. */
export function ensembleProfile(seed: number, index: number): Profile {
	const offset = Math.floor(hashUnit(seed, 'ensemble', 'profile') * 3);
	const group = Math.floor(index / 3) * 3;
	return profiles[group + ((index + offset) % Math.min(3, profiles.length - group))];
}
