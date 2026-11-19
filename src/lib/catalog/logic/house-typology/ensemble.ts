import type { HouseSite } from '../composed-house';
import { STORY } from '../../data/grid';
import { collapse } from './collapse';
import { affinities, typologies, type HouseRole, type Typology } from './families';
import { survey, type Survey } from './survey';

type Decision = { role: HouseRole; typology: Typology };
export type EnsembleContext = {
	datum: number;
	skyline: number;
	seed: number;
	houses: ReadonlyMap<string, Decision>;
};

function skyline(sites: Survey[], seed: number) {
	const roles = new Map<string, HouseRole>(sites.map((s) => [s.id, 'medium']));
	const sorted = [...sites].sort((a, b) => a.programme.length - b.programme.length);
	const top = sorted.at(-1)!;
	const ties = sorted.filter((s) => s.programme.length === top.programme.length);
	const high = collapse(
		'ensemble/high',
		seed,
		'skyline',
		ties.map((s) => [s.id, 1])
	);
	roles.set(high, 'high');
	const lows = sorted.filter((s) => s.id !== high);
	for (let i = 0; i < Math.min(lows.length, Math.ceil(sites.length / 4)); i++) {
		const h = lows[0].programme.length;
		const id = collapse(
			'ensemble/low/' + i,
			seed,
			'high/' + high,
			lows.filter((s) => s.programme.length === h).map((s) => [s.id, 1])
		);
		roles.set(id, 'low');
		lows.splice(
			lows.findIndex((s) => s.id === id),
			1
		);
	}
	return roles;
}

function houseLayer(sites: Survey[], roles: Map<string, HouseRole>, seed: number) {
	const weights = sites.map((s) => affinities(s, roles.get(s.id)!));
	const houses = new Map<string, Decision>();
	const assign = (i: number, typology: Typology) =>
		houses.set(sites[i].id, { role: roles.get(sites[i].id)!, typology });
	if (sites.length === 1) {
		assign(
			0,
			collapse(
				'house/' + sites[0].id,
				seed,
				roles.get(sites[0].id)!,
				typologies.map((t) => [t, weights[0][t]])
			)
		);
		return houses;
	}
	const palettes = new Map<string, { forms: Typology[]; weight: number }>();
	for (const [i, a] of typologies.entries())
		for (const b of typologies.slice(i + 1)) {
			// With a fixed count, exchanging two houses improves the product iff their affinity ratios are out of order.
			const order = sites
				.map((_, j) => j)
				.sort((j, k) => weights[k][a] * weights[j][b] - weights[j][a] * weights[k][b]);
			const forms: Typology[] = sites.map(() => b);
			for (const j of order.slice(0, Math.ceil(order.length / 2))) forms[j] = a;
			const weight = Math.pow(
				forms.reduce((product, t, j) => product * weights[j][t], 1),
				2 / sites.length
			);
			if (weight > 0) palettes.set(a + '~' + b, { forms, weight });
		}
	const key = collapse(
		'house/palette/' + sites.map((s) => s.id).join('|'),
		seed,
		sites.map((s) => roles.get(s.id)).join('|'),
		[...palettes].map(([name, p]) => [name, p.weight])
	);
	palettes.get(key)!.forms.forEach((type, i) => assign(i, type));
	return houses;
}
/** Solves one ensemble (one to eight houses) in stable site order. Datum is the first shared half-storey above all painted bases. */
export function planEnsemble(sites: readonly HouseSite[], seed?: number): EnsembleContext {
	if (!sites.length || sites.length > 8) throw new RangeError('Expected one to eight house sites');
	const sorted = sites.map(survey).sort((a, b) => a.id.localeCompare(b.id));
	if (new Set(sorted.map((s) => s.id)).size !== sites.length)
		throw new RangeError('Duplicate house site');
	const selectedSeed = seed ?? sorted[0].seed;
	const origin = Math.min(...sorted.map((s) => s.ground)),
		step = STORY / 2;
	const datum =
		origin + step * (1 + Math.ceil((Math.max(...sorted.map((s) => s.base)) - origin) / step));
	const ceiling = datum + STORY * Math.max(...sorted.map((s) => s.programme.length)) + step;
	return {
		seed: selectedSeed,
		datum,
		skyline: ceiling,
		houses: houseLayer(sorted, skyline(sorted, selectedSeed), selectedSeed)
	};
}
