import { required } from '../required';
import { interpolatePoint, type Vec3 } from '../parametrik/types';

type Center = (id: string) => Vec3;
type Station = { position: Vec3; arms: string[] };
type Stations = Map<string, Station>;
export type TownSpan = { id: string; a: Vec3; b: Vec3 };

/** Seats junctions on the two-metre level grid and draws the three arms
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
			position: ends.get(id) ?? [x, y, 2 * Math.ceil((z + 1) / 2)],
			arms: []
		};
		station.arms.push(next);
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

function landing(s: Station, other: Station) {
	if (s.arms.length !== 3) return s.position;
	const p = s.position,
		q = other.position,
		d = Math.hypot(q[0] - p[0], q[1] - p[1]);
	const end = interpolatePoint(p, q, Math.min(0.24, 1.8 / d));
	end[2] = p[2];
	return end;
}

/** Ends each flight on level decking and leaves three open mouths at a fork. */
export function townSpans(
	routes: readonly string[][],
	stations: Stations,
	ends: ReadonlyMap<string, Vec3>
): TownSpan[] {
	return routes.flatMap((path) =>
		path.slice(1).flatMap((id, i) => {
			const from = required(stations.get(path[i]), 'surveyed site'),
				to = required(stations.get(id), 'surveyed site');
			const a = landing(from, to),
				b = landing(to, from);
			const key = 'town-walk/' + path[i] + '>' + id;
			if (a[2] === b[2] || ends.has(path[i])) return [{ id: key, a, b }];
			const middle = interpolatePoint(a, b, 0.45);
			middle[2] = a[2];
			return [
				{ id: key, a, b: middle },
				{ id: key + '/stair', a: middle, b }
			];
		})
	);
}
