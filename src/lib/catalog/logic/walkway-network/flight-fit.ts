import type { Vec3 } from '../parametrik/types';
import { treadCount } from '../walkway';
import type { TownSpan } from './town-stations';
import { needsTreads, walkingProfile } from './walking-profile';

/** Clear lateral extent measured from the link centreline toward the reserved side. */
export type FlightReservation = { side: 'left' | 'right'; depth: number };
type ShortFlight = { id: string; rise: number; availableRun: number; requiredRun: number };
const going = (rise: number) => treadCount(rise, walkingProfile.treadRise) * walkingProfile.going;
function fold(span: TownSpan, run: number, site: FlightReservation) {
	const { a, b, id } = span,
		turn = walkingProfile.width / 2 + 0.03;
	const rise = b[2] - a[2],
		leg = going(rise / 2),
		mid = a[2] + rise / 2;
	const depth = 2 * turn + leg;
	if (
		!Number.isFinite(site.depth) ||
		run < 2 * turn + walkingProfile.width ||
		site.depth < depth + walkingProfile.width / 2
	)
		return;
	const dx = (b[0] - a[0]) / run,
		dy = (b[1] - a[1]) / run,
		sign = site.side === 'left' ? 1 : -1;
	const at = (s: number, n: number, z: number): Vec3 => [
		a[0] + s * dx - sign * n * dy,
		a[1] + s * dy + sign * n * dx,
		z
	];
	const near = turn,
		far = run - turn;
	const points = [
		a,
		at(near, 0, a[2]),
		at(near, turn, a[2]),
		at(near, turn + leg, mid),
		at(near, depth, mid),
		at(far, depth, mid),
		at(far, turn + leg, mid),
		at(far, turn, b[2]),
		at(far, 0, b[2]),
		b
	];
	return points.slice(1).map((p, i): TownSpan => ({
		id: id + '/fold/' + i,
		a: points[i],
		b: p,
		fromFork: i === 0 ? span.fromFork : undefined,
		toFork: i === points.length - 2 ? span.toFork : undefined
	}));
}
/** Fits flights between surveyed terminals. A short straight run uses only
 * explicitly reserved lateral space. Unresolved links report both lengths in metres. */
export function fitWalkingFlights(
	spans: TownSpan[],
	reservations: ReadonlyMap<string, FlightReservation>
) {
	const fitted: TownSpan[] = [],
		unresolved: ShortFlight[] = [];
	for (const span of spans) {
		const { a, b, id } = span,
			rise = b[2] - a[2],
			availableRun = Math.hypot(b[0] - a[0], b[1] - a[1]),
			requiredRun = going(rise);
		if (!needsTreads(a, b) || availableRun + 1e-8 >= requiredRun) {
			fitted.push(span);
			continue;
		}
		const site = reservations.get(id),
			detour = site && fold(span, availableRun, site);
		if (detour) fitted.push(...detour);
		else unresolved.push({ id, rise, availableRun, requiredRun });
	}
	return { spans: fitted, unresolved };
}
