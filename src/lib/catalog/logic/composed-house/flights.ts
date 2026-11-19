import { houseStair } from '../../data/house-stair';
import { housePath } from '../house-typology';
import type { Vec3 } from '../parametrik/types';
import { roofLanding } from './roof-landing';
import { terrainHeight } from './ground';
import { houseObject } from './house-object';
import type { HouseSurfaces } from './surfaces';
import type { Section } from './types';

type Leg = { from: Vec3; to: Vec3; kind: 'stairs' | 'landing'; steps: number; flight: number };
const { going, rise, width } = houseStair;

function footprint(s: Section) {
	const { x, width: span } = s.composition.bay;
	const path = housePath(s.typology);
	const run = Math.min(path === 'core' ? 3.5 : 7, span - width);
	const flank = path === 'cascade' || path === 'external' || path === 'core';
	const center = flank ? x - (span - width - run) / 2 : x;
	return { run, center };
}

function descend(from: Vec3, target: number, flight: number, run: number, sign: number, side: number) {
	const count = Math.max(1, Math.round((from[2] - target) / rise));
	const flights = Math.ceil(count / Math.max(1, Math.floor(run / going)));
	const legs: Leg[] = [];
	let at = from;
	for (let i = 0; i < flights; i++) {
		const steps = Math.round((i + 1) * count / flights) - Math.round(i * count / flights);
		const direction = sign * (-1) ** i;
		const to: Vec3 = [at[0] + direction * steps * going, at[1], at[2] - steps * (from[2] - target) / count];
		legs.push({ from: at, to, steps, flight, kind: 'stairs' });
		at = to;
		if (i + 1 < flights) {
			at = [to[0], to[1] + side * (-1) ** i * width, to[2]];
			legs.push({ from: to, to: at, steps: 0, flight, kind: 'landing' });
		}
	}
	return legs;
}

/** Surveys straight runs between the actual rear landing doors. */
export function flightRoute(s: Section) {
	const { run, center } = footprint(s);
	const doors = [roofLanding(s), ...s.composition.levels.map(l => l.landing).reverse()];
	const sign = s.composition.accessSide === 'north' ? 1 : -1;
	const y = roofLanding(s)[1] + sign * width / 2;
	const ground = s.start ? s.base[2] : terrainHeight(s, [center, y, 0]);
	const stops: Vec3[] = [];
	const legs: Leg[] = [];
	let at: Vec3 = [center - run / 2, y, s.top];
	const docks = doors.map((door, flight) => {
		const direction = (-1) ** flight;
		const station: Vec3 = [center - direction * run / 2, y, door[2]];
		if (flight && Math.hypot(at[0] - station[0], at[1] - station[1]) > 1e-8)
			legs.push({ from: at, to: station, kind: 'landing', steps: 0, flight });
		stops.push(station);
		const pieces = descend(station, doors[flight + 1]?.[2] ?? ground, flight, run, direction, sign);
		legs.push(...pieces);
		at = pieces[pieces.length - 1].to;
		return { station, door };
	});
	stops.push(at);
	return { axis: s.stairAxis, width, legs, docks, stops };
}

function rectangle(a: Vec3, b: Vec3, w: number): [number, number][] {
	const dx = b[0] - a[0], dy = b[1] - a[1];
	const length = Math.hypot(dx, dy) || 1;
	const u = -dy * w / (2 * length), v = dx * w / (2 * length);
	return [[a[0]+u,a[1]+v],[a[0]-u,a[1]-v],[b[0]-u,b[1]-v],[b[0]+u,b[1]+v]];
}

/** Instantiates rigid straight treads and cuts level landings between each stair and its door. */
export function flightAccess(s: Section, surfaces: HouseSurfaces) {
	const route = flightRoute(s), id = s.id + '/stair/';
	const stock = (name: string, variant: string, deck: HouseSurfaces['deck']) => {
		const p = houseObject(name, variant, s.seed, { instanceId: id, slots: { deck, body: surfaces.frame } }).parts[0];
		if (p.kind !== 'prism') throw Error('Expected stair plate');
		return p;
	};
	const tread = stock('stairs', 'straight-tread', surfaces.access);
	const plate = stock('landing', 'mast-platform', surfaces.deck);
	const platform = (from: Vec3, to: Vec3, key: string) => ({
		...plate, id: id + key, polygon: rectangle(from, to, width), z: from[2] - plate.height
	});
	const parts = route.legs.flatMap(({ from, to, steps, kind }, i) => {
		if (kind === 'landing') return [platform(from, to, i + '/landing')];
		return Array.from({ length: steps }, (_, j) => {
			const x = from[0] + (to[0] - from[0]) * (j + 0.5) / steps;
			const z = from[2] + (to[2] - from[2]) * (j + 1) / steps;
			return { ...tread, id: id + i + '/tread/' + j, z: z - tread.height,
				polygon: tread.polygon.map(([u,v]): [number,number] => [x+u, from[1]+v]) };
		});
	});
	return parts.concat(route.docks.map(({ station, door }, i) => platform(station, door, 'dock/' + i)));
}
