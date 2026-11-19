import type { BuildingMethod } from '../../data/sandbox';
import { hashUnit } from '../../core/random';

const styles = ['composed', 'megastructure', 'totem'] as const satisfies readonly BuildingMethod[];
export type StyleWeights = Readonly<Record<(typeof styles)[number], number>>;
const families = [
	{
		character: 'village',
		weights: [8, 1, 1],
		towerShare: 0.04,
		landmark: 'dome',
		variant: 'lantern'
	},
	{
		character: 'metropolitan',
		weights: [2, 7, 1],
		towerShare: 0.65,
		landmark: 'faceted-sculpture',
		variant: 'spire'
	},
	{
		character: 'island',
		weights: [2, 1, 7],
		towerShare: 0.2,
		landmark: 'water-tower',
		variant: 'elevated-bowl'
	},
	{
		character: 'eco-zone',
		weights: [6, 3, 1],
		towerShare: 0.1,
		landmark: 'observatory',
		variant: 'slit-dome'
	}
] as const;

/** Orders distinct families by a seeded draw keyed by character name. */
export function characters(seed: number) {
	return families
		.map((family) => ({ ...family, rank: hashUnit(seed, family.character, 'centre-order') }))
		.sort((a, b) => a.rank - b.rank);
}

/** Maps a triple in canonical method order to the public named weights. */
export function mix(composed: number, megastructure: number, totem: number): StyleWeights {
	const sum = composed + megastructure + totem;
	return { composed: composed / sum, megastructure: megastructure / sum, totem: totem / sum };
}

/** Produces detached style weights for one centre with its family bias. */
export function centreMix(seed: number, id: string, weights: readonly number[]) {
	const w = styles.map((style, i) => weights[i] * (0.75 + 0.5 * hashUnit(seed, id, style)));
	return mix(w[0], w[1], w[2]);
}
