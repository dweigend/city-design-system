import type { RailEdgeReport } from './rail-edge';
import { parcelSupports } from './stair-parcel';
import { mountRamp } from './ground-ramp';
import { flightRail } from './flight-rail';
import { flightAccess } from './flights';
import { houseStair } from '../../data/house-stair';
import { edge, publicStair, pairedTreads, treadSpine } from './stair-track';
import { mastAccess } from './mast-access';
import { windingRoute } from './circulation';
import { houseObject, type StockPart, type HousePart } from './house-object';
import type { Section } from './types';
import { houseSurfaces, roleSurface, type HouseSurfaces } from './surfaces';

type Route = ReturnType<typeof windingRoute>;
type XY = [number, number];
const { width } = houseStair;

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
	const spine = stock('landing', 'mast-platform', { deck: surfaces.frame })[0];
	if (straight.kind !== 'prism' || landing.kind !== 'prism' || spine.kind !== 'prism')
		throw new Error('Expected circulation stock');
	return { id, straight, landing, spine };
}
function projection(track: Route['track'], s: Section, surfaces: HouseSurfaces) {
	const { id, straight, landing, spine } = circulationStock(s, surfaces);
	function platform(key: string, polygon: XY[], z: number) {
		return {
			...landing,
			structuralRole: 'cantilever' as const,
			id: id + key,
			polygon,
			height: 0.12,
			z: z - 0.12
		};
	}
	function sector(a: number, b: number, inner: number, w: number): XY[] {
		return [
			edge(track[a], inner),
			edge(track[a], inner + w),
			edge(track[b], inner + w),
			edge(track[b], inner)
		];
	}
	function walk(leg: Route['legs'][number], i: number): HousePart[] {
		const { first, last } = leg;
		if (leg.kind === 'ramp') return mountRamp(s, surfaces, leg.from, leg.to, id + i + '/ramp');
		const step = leg.kind === 'stairs';
		const stock = step ? straight : landing;
		const treads = pairedTreads(
			stock,
			id + i + (step ? '/stairs/tread' : '/landing'),
			track[first],
			track[last],
			leg.to[2]
		);
		return [...treads, treadSpine(spine, id + i, track[first], track[last], leg.to[2])];
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
	return { walk, connection };
}

/** Places rigid registry treads on the walking line and fits stock to its level deck connections. */
export function access(s: Section, surfaces: HouseSurfaces, reports?: RailEdgeReport[]) {
	if (s.compact) return mastAccess(s, surfaces);
	if (s.composition.path !== 'spiral') return flightAccess(s, surfaces, reports);
	const route = windingRoute(s),
		draw = projection(route.track, s, surfaces);
	const walk = [...route.legs.flatMap(draw.walk), ...route.docks.flatMap(draw.connection)];
	return [
		...walk,
		...flightRail(
			s,
			route.legs
				.filter((l) => l.kind !== 'ramp')
				.map((l) => ({
					flight: l.flight,
					a: route.track[l.first],
					b: route.track[l.last],
					high: l.from[2],
					low: l.to[2]
				})),
			route.width,
			surfaces,
			walk,
			reports
		)
	];
}

/** Surveys the horizontal profile once for each distinct stock position, including every door connection. */
export function fitsWinding(
	s: Section,
	contains: (p: StockPart) => boolean,
	clear: (p: StockPart) => boolean
) {
	const route = windingRoute(s),
		draw = projection(route.track, s, houseSurfaces);
	for (const [i, dock] of route.docks.entries())
		if (!draw.connection(dock, i).every((p) => contains(p) && clear(p))) return false;
	const seen = new Set<string>();
	for (const [i, leg] of route.legs.entries()) {
		if (leg.kind === 'ramp') {
			if (!draw.walk(leg, i).every(clear)) return false;
			continue;
		}
		const key = leg.first + '/' + leg.kind;
		if (seen.has(key)) continue;
		seen.add(key);
		if (
			!draw
				.walk(leg, i)
				.every(
					(p) =>
						contains(p) &&
						(p.structuralRole !== 'bearing' || p.kind !== 'prism' || parcelSupports(s, p.polygon))
				)
		)
			return false;
	}
	return true;
}
