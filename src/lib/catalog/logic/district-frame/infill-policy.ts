import { weightedForm } from '../../core/neighbourhood';

export type FutureTarget = 'sponge-city';

const spongeCityInfill = [
	{ form: 'bare', end: 1 },
	{ form: 'tank', end: 4 }
] as const;

/**
 * Selects an infill form for a new bay by stable seam ID and world seed.
 * The default is bare. The sponge city target weights a tank three times as much as a bare bay.
 */
export function frameInfill(seed: number, seam: string, target?: FutureTarget): 'bare' | 'tank' {
	if (target !== 'sponge-city') return 'bare';
	return weightedForm(spongeCityInfill, seed, seam, 'tg-infill-v1');
}
