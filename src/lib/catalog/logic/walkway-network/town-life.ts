import { hashUnit } from '../../core/random';
import { chainage, pathPoint } from '../linear-path';
import type { Vec3 } from '../parametrik/types';
import { fitting, mountFitting } from './town-scatter';

type Reach = { id: string; path: Vec3[] };
const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function survey({ id, path }: Reach, seed: number) {
	const ds = chainage(path);
	const length = ds.at(-1) ?? 0;
	const count = Math.floor(length / 10);
	const sites = Array.from({ length: count }, (_, i) => {
		const d = ((i + 0.5) * length) / count;
		const feet = pathPoint(path, ds, d),
			ahead = pathPoint(path, ds, d + 0.1);
		return {
			id: id + '/life/' + i,
			feet,
			angle: Math.atan2(ahead[1] - feet[1], ahead[0] - feet[0]),
			rank: hashUnit(seed, id, i)
		};
	});
	return { length, sites };
}

/** Spreads up to eight walkers along the finished ribbon, starting with each occupied court's approach. */
export function townLife(reaches: Reach[], courts: Vec3[], seed: number) {
	const spans = reaches.map((reach) => survey(reach, seed));
	const sites = spans.flatMap((s) => s.sites).sort((a, b) => a.rank - b.rank);
	const count = Math.min(8, Math.round(spans.reduce((sum, s) => sum + s.length, 0) / 60));
	const placed: typeof sites = [];
	function seat(site: (typeof sites)[number]) {
		if (placed.length >= count || placed.some((s) => distance(s.feet, site.feet) < 18))
			return false;
		placed.push(site);
		return true;
	}
	for (const court of courts) {
		if (placed.length >= count) break;
		sites.toSorted((a, b) => distance(a.feet, court) - distance(b.feet, court)).some(seat);
	}
	for (const site of sites) {
		if (placed.length >= count) break;
		seat(site);
	}
	const walker = fitting('kit-scatter-walk');
	return placed.flatMap((site) =>
		mountFitting(walker.id, walker.variants[0], site.feet, site.id, seed, site.angle)
	);
}
