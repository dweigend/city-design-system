import { dockBoundsOverlap, type Bounds, type DockedModule } from '../megastructure';

type Site = { seat: { shell: DockedModule }; bounds: Bounds[] };

function adjacent(a: Site, b: Site, reach: number) {
	const [x, y] = a.seat.shell.center;
	const [u, v] = b.seat.shell.center;
	return (
		Math.hypot(x - u, y - v) <= reach &&
		!a.bounds.some((box) => b.bounds.some((other) => dockBoundsOverlap(box, other)))
	);
}

/** Index survey order in bins one adjacency radius wide. Only nine bins can contain neighbours. */
function neighbors<T extends Site>(sites: T[], reach: number) {
	const bins = new Map<string, number[]>();
	const bin = (s: T) => s.seat.shell.center.slice(0, 2).map((v) => Math.floor(v / reach));
	for (const [index, site] of sites.entries()) {
		const key = bin(site).join('/');
		const bucket = bins.get(key);
		if (bucket) bucket.push(index);
		else bins.set(key, [index]);
	}
	return (site: T) => {
		const [x, y] = bin(site);
		const found: number[] = [];
		for (let i = x - 1; i <= x + 1; i++)
			for (let j = y - 1; j <= y + 1; j++)
				for (const k of bins.get(i + '/' + j) ?? [])
					if (adjacent(site, sites[k], reach)) found.push(k);
		return found.sort((a, b) => a - b);
	};
}

/** Choose the first compatible lower pair and upper accent in original survey order.
 * Pairing uses only clear seats in adjacent bins and never invokes the docking solver. */
export function compatibleGroup<T extends Site>(shells: T[], accents: T[], pitch: number) {
	if (!accents.length || shells.length < 2) return;
	const reach = pitch * 6,
		upper = neighbors(accents, reach),
		lower = neighbors(shells, reach);
	for (const [i, first] of shells.entries()) {
		const choices = upper(first);
		if (!choices.length) continue;
		for (const j of lower(first)) {
			if (j <= i) continue;
			const k = choices.find((k) => adjacent(shells[j], accents[k], reach));
			if (k !== undefined) return [first, shells[j], accents[k]];
		}
	}
}
