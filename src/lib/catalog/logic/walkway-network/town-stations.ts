import { flightRun, gradeWalkLinks } from './link-grades';
import { needsTreads, walkingProfile } from './walking-profile';
import { required } from '../required';
import { interpolatePoint, type Vec3 } from '../parametrik/types';

type Center = (id: string) => Vec3;
type Station = { position: Vec3; arms: string[] };
type Stations = Map<string, Station>;
export type TownSpan = {
	id: string;
	a: Vec3;
	b: Vec3;
	fromFork?: string;
	toFork?: string;
	port?: import('../movement-network').MovementPort;
	inside?: boolean;
	adapter?: boolean;
};

/** Seats junctions on the surveyed route and draws the three arms
 * towards their common bisector. Each court keeps its surveyed landing. */
export function townStations(
	routes: readonly string[][],
	center: Center,
	ends: ReadonlyMap<string, Vec3>
) {
	const stations: Stations = new Map();
	const add = (id: string, next: string) => {
		const [x, y, z] = center(id);
		const station: Station = stations.get(id) ?? {
			position: ends.get(id) ?? [x, y, z],
			arms: []
		};
		if (!station.arms.includes(next)) station.arms.push(next);
		stations.set(id, station);
	};
	for (const path of routes)
		for (let i = 1; i < path.length; i++) {
			add(path[i - 1], path[i]);
			add(path[i], path[i - 1]);
		}
	for (const [id, s] of stations)
		if (s.arms.length === 3) {
			const [x, y] = center(id);
			for (const next of s.arms) {
				const q = center(next),
					d = Math.hypot(q[0] - x, q[1] - y);
				s.position[0] += (0.65 * (q[0] - x)) / d;
				s.position[1] += (0.65 * (q[1] - y)) / d;
			}
		}
	for (const path of routes) breakLongRuns(path, stations);
	return stations;
}

function breakLongRuns(path: string[], stations: Stations) {
	let straight = 0;
	for (let i = 1; i < path.length - 1; i++) {
		const a = required(stations.get(path[i - 1]), 'previous station').position;
		const s = required(stations.get(path[i]), 'bend station'),
			b = s.position;
		const c = required(stations.get(path[i + 1]), 'next station').position;
		const dx = b[0] - a[0],
			dy = b[1] - a[1],
			run = Math.hypot(dx, dy);
		const u = c[0] - b[0],
			v = c[1] - b[1],
			next = Math.hypot(u, v);
		straight += run;
		if (s.arms.length !== 2 || (dx * u + dy * v) / (run * next) < 0.995) {
			straight = 0;
			continue;
		}
		if (straight + next <= 24) continue;
		b[0] -= (0.65 * dy) / run;
		b[1] += (0.65 * dx) / run;
		straight = 0;
	}
}

function landing(s: Station, other: Station, stations: Stations) {
	if (s.arms.length !== 3) return s.position;
	const p = s.position,
		q = other.position,
		d = Math.hypot(q[0] - p[0], q[1] - p[1]);
	const heading = Math.atan2(q[1] - p[1], q[0] - p[0]);
	const turns = s.arms
		.map((id) => required(stations.get(id), 'junction arm'))
		.filter((arm) => arm !== other)
		.map(({ position: r }) =>
			Math.abs(
				Math.atan2(
					Math.sin(Math.atan2(r[1] - p[1], r[0] - p[0]) - heading),
					Math.cos(Math.atan2(r[1] - p[1], r[0] - p[0]) - heading)
				)
			)
		);
	const setback = walkingProfile.width / 2 / Math.tan(Math.min(...turns) / 2) + 0.32;
	const requiredRun = flightRun(q[2] - p[2], walkingProfile);
	const share = other.arms.length === 3 ? 0.5 : 1;
	const reserve = p[2] === q[2] ? setback : Math.max(0.1, (d - requiredRun) * share);
	const end = interpolatePoint(p, q, Math.min(0.49, setback / d, reserve / d));
	end[2] = p[2];
	return end;
}

/** Surveys the clear run after fork setbacks and grades each shared landing once. */
export function townLinkSurvey(
	routes: readonly string[][],
	stations: Stations,
	ends: ReadonlyMap<string, Vec3>
) {
	const mouths = routes.flatMap((path) =>
		path.slice(1).map((to, i) => {
			const from = path[i];
			const start = required(stations.get(from), 'from station');
			const end = required(stations.get(to), 'to station');
			return { from, to, a: landing(start, end, stations), b: landing(end, start, stations) };
		})
	);
	const links = gradeWalkLinks(mouths, ends, walkingProfile);
	for (const { from, to, a, b } of links) {
		required(stations.get(from), 'from station').position[2] = a[2];
		required(stations.get(to), 'to station').position[2] = b[2];
	}
	return links;
}

/** Ends each flight on level decking and leaves three open mouths at a fork. */
export function townSpans(
	links: ReturnType<typeof townLinkSurvey>,
	stations: Stations,
	ends: ReadonlyMap<string, Vec3>,
	ground?: (x: number, y: number) => number
): TownSpan[] {
	return links.flatMap<TownSpan>(({ from, to, a: first, b: last, requiredRun, availableRun }) => {
		const start = required(stations.get(from), 'from station');
		const end = required(stations.get(to), 'to station');
		const a = start.arms.length === 3 ? first : start.position;
		const b = end.arms.length === 3 ? last : end.position;
		const key = 'town-walk/' + from + '>' + to;
		const fromFork = start.arms.length === 3 ? from : undefined,
			toFork = end.arms.length === 3 ? to : undefined;
		if (a[2] === b[2] || ends.has(from)) return [{ id: key, a, b, fromFork, toFork }];
		// Keep the level turning landing where a sharp miter would enter the bank.
		const upper = a[2] > b[2] ? start : end;
		const rampRun = leadRun(a, b, requiredRun, () => buriedCorner(upper, stations, ground));
		return levelLead({ id: key, a, b, fromFork, toFork }, rampRun, availableRun);
	});
}
function leadRun(a: Vec3, b: Vec3, stairRun: number, meetsBank: () => boolean) {
	if (needsTreads(a, b) || meetsBank()) return stairRun;
	return Math.abs(b[2] - a[2]) / walkingProfile.gradeLimit;
}
function buriedCorner(
	station: Station,
	stations: Stations,
	ground?: (x: number, y: number) => number
) {
	if (!ground || station.arms.length !== 2) return false;
	const [x, y, z] = station.position;
	const [u, v] = station.arms.map((id) => {
		const p = required(stations.get(id), 'turning arm').position;
		const dx = p[0] - x,
			dy = p[1] - y,
			d = Math.hypot(dx, dy);
		return [dx / d, dy / d];
	});
	// Intersect both offset lines at the common station.
	const divisor = 1 - u[0] * v[0] - u[1] * v[1];
	if (divisor < 1e-8) return true;
	const scale = walkingProfile.width / (2 * divisor);
	const mx = scale * (v[1] - u[1]),
		my = scale * (u[0] - v[0]);
	return ground(x + mx, y + my) >= z || ground(x - mx, y - my) >= z;
}
function levelLead(
	{ id, a, b, fromFork, toFork }: TownSpan,
	requiredRun: number,
	availableRun: number
): TownSpan[] {
	const rising = b[2] > a[2];
	const share = Math.min(rising ? 0.55 : 0.45, 1 - requiredRun / availableRun);
	if (share * availableRun < walkingProfile.width / 2 + 0.15)
		return [{ id, a, b, fromFork, toFork }];
	const middle = interpolatePoint(a, b, rising ? 1 - share : share);
	middle[2] = Math.max(a[2], b[2]);
	return rising
		? [
				{ id: id + '/stair', a, b: middle, fromFork },
				{ id, a: middle, b, toFork }
			]
		: [
				{ id, a, b: middle, fromFork },
				{ id: id + '/stair', a: middle, b, toFork }
			];
}
