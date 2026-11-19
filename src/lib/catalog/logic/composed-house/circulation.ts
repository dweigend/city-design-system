import type { Vec3 } from '../parametrik/types';
import type { Deck, Section } from './types';
import { roofLanding } from './deck-plan';
import { footprintBay } from './footprint';

type Leg = { from: Vec3; to: Vec3; steps: number; kind: 'stairs' | 'landing' | 'ramp' };
type Bay = ReturnType<typeof footprintBay>;
const going = 0.29;
const rise = 0.17;

/** Reserves a continuous lane around the surveyed building bay, in metres. */
export function circulationWidth(bay: Bay) {
	return Math.min(1.05, bay.width * 0.09, bay.depth * 0.09);
}

/** Sites with a deep rear setback can fit a pair of parallel return flights. */
export function returnCourt(bay: Bay, reverse: boolean) {
	return reverse && bay.depth > 8 * circulationWidth(bay) ? 3.5 * circulationWidth(bay) : 0;
}

function deckDoor(d: Deck, p: Vec3): Vec3 {
	const [x, y, z] = d.position;
	const dx = p[0] - x,
		dy = p[1] - y;
	const u = dx / d.width,
		v = dy / d.depth;
	const t = 0.48 / (d.round ? Math.hypot(u, v) : Math.max(Math.abs(u), Math.abs(v)));
	return [x + dx * t, y + dy * t, z];
}

function terrainHeight(s: Section, [x, y]: Vec3) {
	for (const cell of s.cells) {
		const [a, b, c, d] = cell.corners;
		for (const [p, q] of [
			[b, c],
			[c, d]
		]) {
			const ux = p[0] - a[0],
				uy = p[1] - a[1],
				vx = q[0] - a[0],
				vy = q[1] - a[1];
			const det = ux * vy - uy * vx;
			const u = ((x - a[0]) * vy - (y - a[1]) * vx) / det,
				v = (ux * (y - a[1]) - uy * (x - a[0])) / det;
			if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8)
				return a[2] + u * (p[2] - a[2]) + v * (q[2] - a[2]);
		}
	}
	throw new RangeError('Access outside painted ground');
}

/** Surveys the stair from the roof down, with level branches onto the decks.
 * Distances along each facade stop short of the corner for a level turn. */
export function circulation(s: Section) {
	const bay = footprintBay(s.cells),
		width = circulationWidth(bay);
	const halfX = bay.width / 2 - width * 0.65,
		halfY = bay.depth / 2 - width * 0.65;
	const sign = s.aspect.reverse ? -1 : 1;
	const court = returnCourt(bay, s.aspect.reverse);
	const corners = [
		[sign, 1],
		[sign, -1],
		[-sign, -1],
		[-sign, 1]
	].map(([u, v]) => [
		bay.x + u * halfX,
		bay.y + (court && v < 0 ? halfY - 2.1 * width : v * halfY)
	]);
	const roof = roofLanding(s);
	let current: Vec3 = [roof[0], bay.y + halfY, s.top],
		side = 0;
	const legs: Leg[] = [];
	const stops: Vec3[] = [roof];
	function add(to: Vec3, kind: Leg['kind'], steps = 0) {
		legs.push({ from: current, to, kind, steps });
		current = to;
	}
	legs.push({ from: roof, to: current, kind: 'landing', steps: 0 });
	function advance(length: number, drop = 0, steps = 0) {
		const [x, y] = corners[side],
			dx = x - current[0],
			dy = y - current[1],
			distance = Math.hypot(dx, dy);
		add(
			[
				current[0] + (dx * length) / distance,
				current[1] + (dy * length) / distance,
				current[2] - drop
			],
			steps ? 'stairs' : 'landing',
			steps
		);
	}
	function corner() {
		const [x, y] = corners[side];
		add([x, y, current[2]], 'landing');
		side = (side + 1) % 4;
		advance(width * 0.6);
	}
	function descend(z: number) {
		const delta = current[2] - z;
		const total = Math.max(1, Math.round(delta / rise));
		const run = Math.min(going, Math.min(halfX, halfY) * 0.5);
		let left = total;
		while (left > 0) {
			const [x, y] = corners[side];
			const available = Math.hypot(x - current[0], y - current[1]) - width * 0.6;
			const count = Math.min(left, 17, Math.floor(available / run));
			if (count <= 0) {
				corner();
				continue;
			}
			advance(count * run, (delta * count) / total, count);
			left -= count;
			const rest = available - count * run;
			if (rest < width) corner();
			else advance(width);
		}
	}
	for (const deck of [...s.decks].reverse()) {
		descend(deck.position[2]);
		const door = deckDoor(deck, current);
		legs.push({ from: current, to: door, kind: 'landing', steps: 0 });
		stops.push(door);
	}
	descend(s.base[2]);
	// An elevated painted run starts at its underlying deck. Ground runs meet the terrain mesh.
	if (s.start === 0) {
		const [x, y] = corners[side];
		const length = Math.hypot(x - current[0], y - current[1]);
		const t = Math.min(1, (width * 2) / length);
		const foot: Vec3 = [current[0] + (x - current[0]) * t, current[1] + (y - current[1]) * t, 0];
		foot[2] = terrainHeight(s, foot);
		add(foot, 'ramp');
	}
	stops.push(current);
	return { width, legs, stops };
}
