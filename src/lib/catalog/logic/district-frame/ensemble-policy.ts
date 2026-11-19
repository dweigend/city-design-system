import { weightedForm } from '../../core/neighbourhood';

export type EnsembleRole = 'sockel' | 'riegel' | 'turm';
export type EnsembleDistrict = 'bank' | 'slope' | 'infill';
export type StoreySurcharge = 0 | 1 | 2;

const roles = {
	bank: [
		{ form: 'riegel', end: 5 },
		{ form: 'sockel', end: 6 }
	],
	slope: [
		{ form: 'riegel', end: 1 },
		{ form: 'sockel', end: 5 }
	],
	infill: [
		{ form: 'riegel', end: 3 },
		{ form: 'sockel', end: 5 }
	]
} as const;

const surcharges = [
	{ form: '0', end: 4 },
	{ form: '1', end: 7 },
	{ form: '2', end: 8 }
] as const;

const setbacks = [
	{ form: '0.3', end: 1 },
	{ form: '0.4', end: 2 },
	{ form: '0.5', end: 3 },
	{ form: '0.6', end: 4 }
] as const;

/** Weighs the body roles available below the ensemble's single tower. */
export function ensembleRole(seed: number, id: string, district: EnsembleDistrict): EnsembleRole {
	return weightedForm(roles[district], seed, id, 'house-ensemble-role-v1');
}

/** Ranks storey surcharges using the district-independent preference for smaller additions. */
export function ensembleSurcharge(seed: number, id: string): StoreySurcharge {
	const form = weightedForm(surcharges, seed, id, 'house-ensemble-height-v1');
	return form === '0' ? 0 : form === '1' ? 1 : 2;
}

/** Returns the later body's additional frontage setback in meters. */
export function ensembleSetback(seed: number, id: string): number {
	return Number(weightedForm(setbacks, seed, id, 'house-ensemble-setback-v1'));
}
