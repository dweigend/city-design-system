import { ensembleSurcharge, type StoreySurcharge } from '../district-frame';
import type { QuadCell } from '../quad-grid';

export type HeightSite = Readonly<{
	cell: QuadCell;
	height: number;
	neighbors: readonly string[];
	joins: readonly string[];
}>;

const SURCHARGES = [0, 1, 2] as const;
const PEAK_RISE = 2;
const SEARCH_STEPS = 4000;

function peakCandidates(sites: readonly HeightSite[]) {
	const mean = (axis: number) =>
		sites.reduce((sum, { cell }) => sum + cell.center[axis], 0) / sites.length;
	const x = mean(0),
		y = mean(1),
		ground = mean(2);
	const distance = ({ cell }: HeightSite) => Math.hypot(cell.center[0] - x, cell.center[1] - y);
	const radius = Math.max(...sites.map(distance));
	return sites
		.filter((site) => site.cell.center[2] >= ground || distance(site) < radius / 2)
		.sort(
			(a, b) =>
				b.height - a.height || distance(a) - distance(b) || b.cell.center[2] - a.cell.center[2]
		);
}

type Domain = Readonly<{ site: HeightSite; heights: readonly number[] }>;

function domains(sites: readonly HeightSite[], seed: number, peak?: HeightSite): Domain[] {
	const ceiling = peak ? peak.height + 2 - PEAK_RISE : Infinity;
	return sites.map((site) => {
		if (site === peak) return { site, heights: [site.height + 2] };
		const preferred = ensembleSurcharge(seed, site.cell.id);
		const heights = [preferred, ...SURCHARGES.filter((rise) => rise !== preferred)]
			.map((rise) => site.height + rise)
			.filter((height) => height <= ceiling);
		return { site, heights };
	});
}

type Heights = Map<string, number>;

function choices({ site, heights }: Domain, assigned: Heights, merge: boolean) {
	return heights.filter((height) =>
		site.neighbors.every((id) => assigned.get(id) !== height || (merge && site.joins.includes(id)))
	);
}

function nextDomain(pending: readonly Domain[], assigned: Heights, merge: boolean) {
	let next: Domain | undefined;
	for (const domain of pending) {
		if (assigned.has(domain.site.cell.id)) continue;
		const heights = choices(domain, assigned, merge);
		if (!heights.length) return { site: domain.site, heights };
		if (
			!next ||
			heights.length < next.heights.length ||
			(heights.length === next.heights.length &&
				domain.site.neighbors.length > next.site.neighbors.length)
		)
			next = { site: domain.site, heights };
	}
	return next;
}

function solve(pending: readonly Domain[], merge: boolean): Heights | undefined {
	const assigned: Heights = new Map();
	let steps = SEARCH_STEPS;
	const search = (): boolean => {
		if (--steps < 0) return false;
		const next = nextDomain(pending, assigned, merge);
		if (!next) return true;
		const id = next.site.cell.id;
		for (const height of next.heights) {
			assigned.set(id, height);
			if (search()) return true;
		}
		assigned.delete(id);
		return false;
	};
	return search() ? assigned : undefined;
}

function closestHeights(pending: readonly Domain[]) {
	const assigned: Heights = new Map();
	for (const { site, heights } of pending) {
		const conflicts = (height: number) =>
			site.neighbors.filter((id) => assigned.get(id) === height && !site.joins.includes(id)).length;
		const best = heights.reduce((best, height) =>
			conflicts(height) < conflicts(best) ? height : best
		);
		assigned.set(site.cell.id, best);
	}
	return assigned;
}

/**
 * Solves one lexical component. All additions stay in 0–2 storeys. If a strict solution
 * fails, equal-height parcels may join across a real wall. If the remaining constraints
 * conflict, retain the peak when possible and prefer the fewest conflicts with placed parcels.
 */
export function ensembleHeights(sites: readonly HeightSite[], seed: number) {
	if (sites.length === 1)
		return {
			peak: sites[0].cell.id,
			heights: new Map([[sites[0].cell.id, sites[0].height]])
		};
	const candidates = peakCandidates(sites);
	const tallest = Math.max(...sites.map((site) => site.height));
	const eligible = candidates.filter((site) => site.height === tallest);
	for (const merge of [false, true])
		for (const peak of eligible) {
			const heights = solve(domains(sites, seed, peak), merge);
			if (heights) return { peak: peak.cell.id, heights };
		}
	const peak = eligible[0];
	const options = domains(sites, seed, peak);
	const heights = (peak ? undefined : solve(options, true)) ?? closestHeights(options);
	return { peak: peak?.cell.id, heights };
}

/** Difference between the solved and painted height, in integer storeys. */
export function surchargeOf(site: HeightSite, heights: Heights): StoreySurcharge {
	const height = heights.get(site.cell.id) ?? site.height;
	return height === site.height + 2 ? 2 : height === site.height + 1 ? 1 : 0;
}
