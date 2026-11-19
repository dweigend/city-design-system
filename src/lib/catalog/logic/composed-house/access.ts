import { flightAccess } from './flights';
import { houseStair } from '../../data/house-stair';
import type { Vec3 } from '../parametrik/types';
import { edge, publicStair, pairedTreads } from './stair-track';
import { mastAccess } from './mast-access';
import { windingRoute } from './circulation';
import { houseObject, type HousePart } from './house-object';
import type { Section } from './types';
import { houseSurfaces, roleSurface, type HouseSurfaces } from './surfaces';

type Route = ReturnType<typeof windingRoute>;
type XY = [number, number];
const { width, rail } = houseStair;
const thickness = 0.12;

function circulationStock(s: Section, surfaces: HouseSurfaces) {
	const id = s.id + '/stair/';
	const stock = (
		name: string,
		variant: string,
		slots: Parameters<typeof houseObject>[3]['slots']
	) => houseObject(name, variant, s.seed, { instanceId: id + name, slots }).parts;
	const straight = stock('stairs', 'straight-tread', {
		deck: roleSurface(surfaces.access, 'deck'),
		body: surfaces.frame
	})[0];
	const landing = stock('landing', 'mast-platform', { deck: surfaces.deck })[0];
	const ramp = stock('ramp', 'standard', { deck: surfaces.deck })[0];
	const rails = stock('railing', 'standard', { frame: surfaces.frame });
	if (straight.kind !== 'prism' || landing.kind !== 'prism' || ramp.kind !== 'wedge')
		throw new Error('Expected circulation stock');
	return { id, straight, landing, ramp, rails };
}
function projection(track: Route['track'], s: Section, surfaces: HouseSurfaces) {
	const { id, straight, landing, ramp, rails } = circulationStock(s, surfaces);
	function platform(key: string, polygon: XY[], z: number) {
		return { ...landing, id: id + key, polygon, z: z - landing.height };
	}
	function sector(a: number, b: number, inner: number, w: number): XY[] {
		return [
			edge(track[a], inner),
			edge(track[a], inner + w),
			edge(track[b], inner + w),
			edge(track[b], inner)
		];
	}
	function incline(a: Vec3, b: Vec3, i: number): HousePart {
		const [hi, lo] = a[2] >= b[2] ? [a, b] : [b, a],
			dx = lo[0] - hi[0],
			dy = lo[1] - hi[1],
			run = Math.hypot(dx, dy);
		return {
			...ramp,
			id: id + i + '/ramp',
			position: [(hi[0] + lo[0] - run) / 2, (hi[1] + lo[1] - width) / 2, lo[2]],
			size: [run, width, hi[2] - lo[2]],
			rotation: Math.atan2(dy, dx)
		};
	}
	function walk(leg: Route['legs'][number], i: number): HousePart[] {
		const { first, last } = leg;
		if (leg.kind === 'ramp' && Math.abs(leg.from[2] - leg.to[2]) > 1e-8)
			return [incline(leg.from, leg.to, i)];
		const step = leg.kind === 'stairs';
		const stock = step ? straight : landing;
		return pairedTreads(
			stock,
			id + i + (step ? '/stairs/tread' : '/landing'),
			track[first],
			track[last],
			leg.to[2]
		);
	}

	function frame(leg: Route['legs'][number], i: number) {
		const line = (end: boolean, h: number): Vec3 => [
			...edge(track[end ? leg.last : leg.first], -publicStair.width / 2 + 0.06),
			(end ? leg.to : leg.from)[2] + h
		];
		return rails.flatMap((p, j) => {
			if (p.kind !== 'pipe') throw new Error('Expected rail stock');
			// Drum-mounted steps carry one inside handrail on spaced newels.
			if (j === 1 || (j === 2 && i % 4)) return [];
			const points =
				j === 0
					? [line(false, rail), line(true, rail)]
					: [line(false, -thickness), line(false, rail)];
			return [{ ...p, id: id + i + '/frame/' + j, radius: Math.max(0.06, p.radius), points }];
		});
	}
	function connection(d: Route['docks'][number], i: number) {
		const distance = (i: number) =>
			Math.hypot(track[i].xy[0] - d.door[0], track[i].xy[1] - d.door[1]);
		const exit = track.reduce((best, _, j) => (distance(j) < distance(best) ? j : best), 0);
		const size = track.length,
			forward = (exit - d.index + size) % size,
			sign = forward <= size / 2 ? 1 : -1;
		const steps = Math.min(forward, size - forward),
			z = d.door[2];
		const pieces = Array.from({ length: steps }, (_, j) => {
			const a = (d.index + size + sign * j) % size,
				b = (a + size + sign) % size;
			return platform('dock/' + i + '/' + j, sector(a, b, 0, width), z);
		});
		const [x, y] = edge(track[exit], publicStair.width / 2);
		const [nx, ny] = track[exit].normal,
			u = (-ny * width) / 2,
			v = (nx * width) / 2;
		pieces.push(
			platform(
				'dock/' + i + '/door',
				[
					[x - u, y - v],
					[x + u, y + v],
					[d.door[0] + u, d.door[1] + v],
					[d.door[0] - u, d.door[1] - v]
				],
				z
			)
		);
		return pieces;
	}
	return { walk, frame, connection };
}

/** Places rigid registry treads on the walking line and fits stock to its level deck connections. */
export function access(s: Section, surfaces: HouseSurfaces) {
	if (s.compact) return mastAccess(s, surfaces);
	if (s.composition.path !== 'spiral') return flightAccess(s, surfaces);
	const route = windingRoute(s),
		draw = projection(route.track, s, surfaces);
	return [
		...route.legs.flatMap((leg, i) => [...draw.walk(leg, i), ...draw.frame(leg, i)]),
		...route.docks.flatMap(draw.connection)
	];
}

/** Surveys the horizontal profile once for each distinct stock position, including every door connection. */
export function fitsWinding(
	s: Section,
	contains: (p: HousePart) => boolean,
	clear: (p: HousePart) => boolean
) {
	const route = windingRoute(s),
		draw = projection(route.track, s, houseSurfaces);
	for (const [i, dock] of route.docks.entries())
		if (!draw.connection(dock, i).every((p) => contains(p) && clear(p))) return false;
	const seen = new Set<string>();
	for (const [i, leg] of route.legs.entries()) {
		const key = leg.first + '/' + leg.kind;
		if (seen.has(key)) continue;
		seen.add(key);
		if (!draw.walk(leg, i).every(contains)) return false;
	}
	return true;
}
