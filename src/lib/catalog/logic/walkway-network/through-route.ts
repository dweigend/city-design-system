import type { Vec3 } from '../parametrik/types';
import { fitWalkingFlights } from './flight-fit';
import type { TownSpan } from './town-stations';
import { walkingProfile } from './walking-profile';

type Threshold = { position: Vec3; outward: readonly [number, number] };
/** World-metre walking clearance surveyed by the envelope owner, from first sill to last. */
export type CourtPassage = {
	id: string;
	entry: Threshold;
	exit: Threshold;
	centreline: readonly Vec3[];
	clearWidth: number;
	headroom: number;
	clearApproach?: (a: Vec3, b: Vec3, width: number) => boolean;
};
type Ground = (x: number, y: number) => number;
type Clear = (a: Vec3, b: Vec3) => boolean;
const width = walkingProfile.width;
function outside({ position: [x, y, z], outward: [u, v] }: Threshold, run: number): Vec3 {
	const length = Math.hypot(u, v);
	return [x + (run * u) / length, y + (run * v) / length, z];
}
function spans(points: readonly Vec3[], prefix: string): TownSpan[] {
	return points.slice(1).map((b, i) => ({ id: prefix + '/' + i, a: points[i], b }));
}
function descent(exit: Threshold, ground: Ground, clear: Clear, id: string) {
	const start = outside(exit, width);
	for (let run = width + 2; run <= 32; run += 1) {
		const foot = outside(exit, run);
		foot[2] = ground(foot[0], foot[1]);
		if (!Number.isFinite(foot[2]) || !clear(start, foot)) return;
		const flight = spans([start, foot], id + '/descent');
		if (!fitWalkingFlights(flight, new Map()).unresolved.length) return flight;
	}
}
function crossing(terminal: Vec3, passage: CourtPassage, ground: Ground, clear: Clear) {
	const { entry, exit } = passage;
	const approach = outside(entry, width);
	const dx = terminal[0] - entry.position[0],
		dy = terminal[1] - entry.position[1];
	if (
		dx * entry.outward[0] + dy * entry.outward[1] <= width ||
		!clear(terminal, approach) ||
		!clear(approach, entry.position)
	)
		return [];
	const id = 'town-walk/passage/' + passage.id;
	const lead = spans([terminal, approach, entry.position], id + '/approach');
	const inside = spans(passage.centreline, id + '/inside').map((s) => ({ ...s, inside: true }));
	const outsideExit = outside(exit, width);
	if (!clear(exit.position, outsideExit)) return [];
	const down = descent(exit, ground, clear, id);
	if (!down) return [];
	const route = [
		...lead,
		...inside,
		...spans([exit.position, outsideExit], id + '/threshold'),
		...down
	];
	const { spans: fitted, unresolved } = fitWalkingFlights(route, new Map());
	return unresolved.length ? [] : fitted;
}

function aligned(passage: CourtPassage) {
	const { entry, exit, centreline } = passage;
	const at = (a: Vec3, b: Vec3) => Math.hypot(...a.map((v, k) => v - b[k])) < 1e-7;
	return (
		centreline.length >= 2 &&
		centreline.every(
			(p, i) =>
				p.every(Number.isFinite) &&
				(i === 0 || Math.hypot(p[0] - centreline[i - 1][0], p[1] - centreline[i - 1][1]) > 1e-7)
		) &&
		[entry, exit].every((s) => Math.abs(Math.hypot(...s.outward) - 1) < 1e-6) &&
		at(entry.position, centreline[0]) &&
		at(exit.position, centreline[centreline.length - 1])
	);
}
/** Connects the reachable sill to its court and the opposite sill to finished ground.
 * Rejects an incomplete, obstructed or undersized passage before emitting geometry. */
export function throughRoute(terminal: Vec3, passage: CourtPassage, ground: Ground, clear: Clear) {
	if (!(passage.clearWidth >= width && passage.headroom >= 2.2) || !aligned(passage)) return [];
	const forward = crossing(terminal, passage, ground, clear);
	if (forward.length) return forward;
	return crossing(
		terminal,
		{
			...passage,
			entry: passage.exit,
			exit: passage.entry,
			centreline: passage.centreline.toReversed()
		},
		ground,
		clear
	);
}
