import { houseEnvelope } from './envelope';
import { roofOwners } from './roof-owners';
import { upperWings } from './upper-wings';
import { frontages, galleryCourses } from './gallery';
import { paletteCount, housePath } from './routes';
import { required } from '../required';
import type { HouseSite } from './site';
import { STORY } from '../../data/grid';
import { collapse } from './collapse';
import { affinities, typologies, type HouseRole, type Typology } from './families';
import { survey, type Survey } from './survey';

import type { Decision, EnsembleContext } from './ensemble-context';
export type { EnsembleContext } from './ensemble-context';

function skyline(sites: Survey[], seed: number) {
	const roles = new Map<string, HouseRole>(sites.map((s) => [s.id, 'medium']));
	if (sites.length === 1) return new Map<string, HouseRole>(sites.map((s) => [s.id, 'high']));
	const sorted = [...sites].sort((a, b) => a.programme.length - b.programme.length);
	const top = required(sorted.at(-1), 'upper datum');
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
		const index = lows.findIndex((s) => s.id === id);
		roles.set(id, lows[index].elongated ? 'bar' : 'plinth');
		lows.splice(index, 1);
	}
	return roles;
}

function away(site: Survey, sites: Survey[]): [number, number] {
	const neighbors = sites.filter(
		(other) =>
			other !== site && site.cells.some((c) => other.cells.some((n) => c.neighbors.includes(n.id)))
	);
	return [0, 1].map((k) =>
		Math.sign(neighbors.reduce((sum, n) => sum + site.center[k] - n.center[k], 0))
	) as [number, number];
}

function wideForms(sites: Survey[], roles: Map<string, HouseRole>, seed: number): Typology[] {
	const weights = sites.map((s) => affinities(s, required(roles.get(s.id), 'ensemble role')));
	if (sites.length < 3) {
		return sites.map((site, j) =>
			collapse(
				'house/' + site.id,
				seed,
				required(roles.get(site.id), 'ensemble role'),
				typologies.map((t) => [
					t,
					sites.length === 2 && housePath(t) === 'spiral' ? 0 : weights[j][t]
				])
			)
		);
	}
	const palettes = new Map<string, { forms: Typology[]; weight: number }>();
	for (const [i, a] of typologies.entries())
		for (const b of typologies.slice(i + 1)) {
			// With a fixed count, exchanging two houses improves the product iff their affinity ratios are out of order.
			const count = paletteCount(a, b, sites.length);
			if (!count) continue;
			const order = sites
				.map((_, j) => j)
				.sort((j, k) => weights[k][a] * weights[j][b] - weights[j][a] * weights[k][b]);
			const forms: Typology[] = sites.map(() => b);
			for (const j of order.slice(0, count)) forms[j] = a;
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
	return required(palettes.get(key), 'chosen palette').forms;
}
function houseLayer(sites: Survey[], roles: Map<string, HouseRole>, seed: number) {
	const streets = frontages(sites);
	const wings = upperWings(sites, streets);
	const galleries = galleryCourses(sites, streets);
	const wide = sites.filter((s) => !s.compact && !streets.get(s.id));
	const chosen = wideForms(wide, roles, seed);
	const forms = new Map(wide.map((s, i) => [s.id, chosen[i]]));
	return new Map<string, Decision>(
		sites.map((s) => [
			s.id,
			{
				roof: 'head',
				role: required(roles.get(s.id), 'ensemble role'),
				typology: forms.get(s.id) ?? 'block',
				away: away(s, sites),
				frontage: streets.get(s.id),
				galleryCourse: galleries.get(s.id),
				upperWing: wings.get(s.id)
			}
		])
	);
}
function shellProgramme(sites: Survey[]) {
	const counts = new Map<Survey['programme'][number][number], number>();
	for (const site of sites)
		for (const use of site.programme.flat()) counts.set(use, (counts.get(use) ?? 0) + 1);
	return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
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
	const context = {
		seed: selectedSeed,
		datum,
		skyline: ceiling,
		shellUse: shellProgramme(sorted),
		leadingSystem: houseEnvelope(sorted[0].id, selectedSeed, sorted[0].envelope).system,
		houses: houseLayer(sorted, skyline(sorted, selectedSeed), selectedSeed)
	};
	if (sorted.length > 1) {
		const heads = roofOwners(sorted, context);
		for (const [id, decision] of context.houses) decision.roof = heads.has(id) ? 'head' : 'terrace';
	}
	return context;
}
