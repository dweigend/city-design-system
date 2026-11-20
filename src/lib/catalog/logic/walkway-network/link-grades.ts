import { treadCount } from '../walkway';
import { houseStair } from '../../data/house-stair';
import type { Vec3 } from '../parametrik/types';
import { required } from '../required';

type Mouths = { from: string; to: string; a: Vec3; b: Vec3 };
type Profile = { treadRise: number; going: number };
/** Public stair dimensions in metres. */
export const townStairs = { treadRise: houseStair.rise, going: houseStair.going };
/** Plan length occupied by the treads between two level landings, in metres. */
export function flightRun(rise: number, profile: Profile) {
	return rise === 0 ? 0 : treadCount(rise, profile.treadRise) * profile.going;
}
type Limit = { from: string; to: string; rise: number };

function spread(levels: Map<string, number>, limits: Limit[]) {
	// Relax both directions. A court's height constraint can reach beyond the first fork.
	for (let i = 1; i < levels.size; i++) {
		let changed = false;
		for (const { from, to, rise } of limits) {
			const a = required(levels.get(from), 'from level');
			const b = required(levels.get(to), 'to level');
			if (a > b + rise) {
				levels.set(from, b + rise);
				changed = true;
			} else if (b > a + rise) {
				levels.set(to, a + rise);
				changed = true;
			}
		}
		if (!changed) break;
	}
}

/** Grades shared landing elevations against the clear run between fork mouths, in metres.
 * Supply each link once, with distinct mouths and one surveyed height per shared station.
 * Keeps court floors fixed and throws RangeError if two fixed floors exceed the connected
 * tread budget. Returned points are detached. The first and last treads both occupy run. */
export function gradeWalkLinks(
	mouths: readonly Mouths[],
	courts: ReadonlyMap<string, Vec3>,
	profile: Profile
) {
	const levels = new Map<string, number>();
	const links = mouths.map(({ from, to, a, b }) => {
		levels.set(from, a[2]);
		levels.set(to, b[2]);
		const run = Math.hypot(b[0] - a[0], b[1] - a[1]);
		return { from, to, a, b, availableRun: run };
	});
	// Leave a sub-micrometre margin when inverting the integer tread count: subtracting
	// two world elevations must not round the rise up into an additional tread.
	const riseMargin = profile.treadRise * 1e-8;
	const limits = links.map(({ from, to, availableRun }) => {
		const treads = Math.floor(availableRun / profile.going);
		const risers = treads - (treads * profile.going > availableRun ? 2 : 1);
		return { from, to, rise: Math.max(0, risers * profile.treadRise - riseMargin) };
	});
	const ceiling = new Map([...levels.keys()].map((id) => [id, courts.get(id)?.[2] ?? Infinity]));
	spread(ceiling, limits);
	// Raising low neighbours first preserves terrain and crossing clearances wherever possible.
	for (const [id, z] of levels) {
		const cap = required(ceiling.get(id), 'ceiling');
		levels.set(id, -(courts.get(id)?.[2] ?? Math.min(z, cap)));
	}
	spread(levels, limits);
	const at = (p: Vec3, id: string): Vec3 => [
		p[0],
		p[1],
		courts.get(id)?.[2] ?? -required(levels.get(id), 'landing')
	];
	return links.map(({ from, to, a, b, availableRun }) => {
		const start = at(a, from),
			end = at(b, to);
		const requiredRun = flightRun(end[2] - start[2], profile);
		if (requiredRun > availableRun)
			throw new RangeError(
				'Insufficient walking run between fixed court levels at ' + from + '>' + to
			);
		return { from, to, a: start, b: end, availableRun, requiredRun };
	});
}
