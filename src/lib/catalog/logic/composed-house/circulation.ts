import { mastRoute } from './mast-access';
import { houseStair } from '../../data/house-stair';
import type { Vec3 } from '../parametrik/types';
import type { Section } from './types';
import { terrainHeight } from './ground';
import { roofLanding } from './deck-plan';
import { stairTrack } from './stair-track';

type Leg = {
	from: Vec3;
	to: Vec3;
	kind: 'stairs' | 'landing' | 'ramp';
	steps: number;
	first: number;
	last: number;
	flight: number;
};
type Dock = { station: Vec3; door: Vec3; index: number };

/** Surveys one descending polyline with one flight per deck interval. Level stations break long climbs. */
export function windingRoute(s: Section) {
	const roof = roofLanding(s),
		axis = s.stairAxis;
	roof[0] += Math.sign(axis[0] - roof[0]) * s.width * 0.3;
	const direction = Math.atan2(s.base[1] - axis[1], s.base[0] - axis[0]);
	const straight = s.aspect.reverse && s.plan !== 'round' ? 4 : 0;
	const track = stairTrack(axis, Math.atan2(roof[1] - axis[1], roof[0] - axis[0]), straight);
	const hand = s.aspect.reverse ? -1 : 1;
	const at = (index: number) => ((index % track.length) + track.length) % track.length;
	let index = 0,
		z = s.top,
		flight = 0;
	const legs: Leg[] = [],
		docks: Dock[] = [],
		stops: Vec3[] = [];
	const point = (): Vec3 => [...track[index].xy, z];
	function advance(drop: number, kind: Leg['kind']) {
		const from = point(),
			first = index;
		index = at(index + hand);
		z -= drop;
		legs.push({
			from,
			to: point(),
			kind,
			steps: Number(kind === 'stairs'),
			first,
			last: index,
			flight
		});
	}
	function dock(door: Vec3) {
		const station = point();
		docks.push({ station, door, index });
		stops.push(station);
	}
	function descend(target: number, steps: number) {
		const drop = (z - target) / steps;
		for (let i = 0; i < steps; i++) {
			if (i && i % 17 === 0) advance(0, 'landing');
			advance(drop, 'stairs');
		}
		advance(0, 'landing');
	}
	dock(roof);
	advance(0, 'landing');
	for (const deck of [...s.decks].reverse()) {
		const target = deck.position[2];
		descend(target, Math.max(1, Math.round((z - target) / houseStair.rise)));
		const dx = -Math.cos(direction),
			dy = -Math.sin(direction),
			u = dx / deck.width,
			v = dy / deck.depth;
		const t = 0.48 / (deck.round ? Math.hypot(u, v) : Math.max(Math.abs(u), Math.abs(v)));
		dock([deck.position[0] + dx * t, deck.position[1] + dy * t, target]);
		flight++;
	}
	// The count determines the final station on the terrain. Survey each possible exit once.
	const exits = track.map((p) => {
		const ground = s.start ? s.base[2] : terrainHeight(s, [...p.xy, 0]);
		const steps = Math.max(1, Math.round((z - ground) / houseStair.rise));
		const end = at(index + hand * (steps + Math.floor((steps - 1) / 17) + 2));
		const actual = s.start ? s.base[2] : terrainHeight(s, [...track[end].xy, 0]);
		const drop = actual + (s.start ? 0 : 0.025);
		return { steps, drop, error: Math.abs((z - drop) / steps - houseStair.rise) };
	});
	const exit = exits.reduce((a, b) => (a.error <= b.error ? a : b));
	descend(exit.drop, exit.steps);
	advance(s.start ? 0 : 0.025, 'ramp');
	stops.push(point());
	return { width: houseStair.width, axis, track, legs, stops, docks };
}

/** Returns the one circulation polyline selected by the site and mass budgets. */
export function circulation(s: Section) {
	return s.compact ? mastRoute(s) : windingRoute(s);
}
