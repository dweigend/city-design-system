import { housePath } from '../house-typology';
import { flightAccess } from './flights';
import { houseStair } from '../../data/house-stair';
import type { Vec3 } from '../parametrik/types';
import { edge } from './stair-track';
import { mastAccess } from './mast-access';
import { windingRoute } from './circulation';
import { houseObject, type HousePart } from './house-object';
import type { Section } from './types';
import { houseSurfaces, type HouseSurfaces } from './surfaces';

type Route = ReturnType<typeof windingRoute>;
type XY = [number, number];
const { radius, width, rail, thickness } = houseStair;

function circulationStock(s: Section, surfaces: HouseSurfaces) {
	const id = s.id + '/stair/';
	const stock = (
		name: string,
		variant: string,
		slots: Parameters<typeof houseObject>[3]['slots']
	) => houseObject(name, variant, s.seed, { instanceId: id + name, slots }).parts;
	const tread = stock('stairs', 'winding-tread', {
		deck: surfaces.access,
		body: surfaces.frame
	})[0];
	const straight = stock('stairs', 'straight-tread', {
		deck: surfaces.access,
		body: surfaces.frame
	})[0];
	const landing = stock('landing', 'mast-platform', { deck: surfaces.deck })[0];
	const ramp = stock('ramp', 'standard', { deck: surfaces.deck })[0];
	const rails = stock('railing', 'standard', { frame: surfaces.frame });
	if (
		straight.kind !== 'prism' ||
		tread.kind !== 'prism' ||
		landing.kind !== 'prism' ||
		ramp.kind !== 'wedge'
	)
		throw new Error('Expected circulation stock');
	return { id, straight, tread, landing, ramp, rails };
}
function projection(track: Route['track'], s: Section, surfaces: HouseSurfaces) {
	const { id, straight, tread, landing, ramp, rails } = circulationStock(s, surfaces);
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
	function stairTread(
		{ from: a, to: b, first, last }: Route['legs'][number],
		i: number
	): HousePart {
		const n = track[first].normal,
			m = track[last].normal;
		const linear = Math.hypot(n[0] - m[0], n[1] - m[1]) < 1e-7;
		const stock = linear ? straight : tread;
		const angle = linear
			? Math.atan2(b[1] - a[1], b[0] - a[0])
			: Math.atan2(n[1] + m[1], n[0] + m[0]);
		const c = Math.cos(angle),
			sin = Math.sin(angle);
		const x = linear ? (a[0] + b[0]) / 2 : a[0] + (c - n[0]) * radius;
		const y = linear ? (a[1] + b[1]) / 2 : a[1] + (sin - n[1]) * radius;
		const polygon = stock.polygon.map(([u, v]): XY => [x + u * c - v * sin, y + u * sin + v * c]);
		return { ...stock, id: id + i + '/stairs/tread', polygon, z: b[2] - thickness };
	}
	function walk(leg: Route['legs'][number], i: number): HousePart {
		const { from: a, to: b, first, last } = leg;
		if (leg.kind === 'landing' || (leg.kind === 'ramp' && Math.abs(a[2] - b[2]) < 1e-8))
			return platform(i + '/landing', sector(first, last, -width / 2, width), a[2]);
		if (leg.kind === 'ramp') return incline(a, b, i);
		return stairTread(leg, i);
	}

	function frame(leg: Route['legs'][number], i: number) {
		const line = (end: boolean, h: number): Vec3 => [
			...edge(track[end ? leg.last : leg.first], -width / 2 + 0.035),
			(end ? leg.to : leg.from)[2] + h
		];
		return rails.flatMap((p, j) => {
			if (p.kind !== 'pipe') throw new Error('Expected rail stock');
			// One inside handrail, a continuous stringer and a newel every four stations.
			if (j === 2 && i % 4) return [];
			const points =
				j === 0
					? [line(false, rail), line(true, rail)]
					: j === 1
						? [line(false, -thickness), line(true, -thickness)]
						: [line(false, -thickness), line(false, rail)];
			return [{ ...p, id: id + i + '/frame/' + j, points }];
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
			return platform('dock/' + i + '/' + j, sector(a, b, width / 2, width / 2), z);
		});
		const [x, y] = edge(track[exit], width / 2);
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
	if (housePath(s.typology) !== 'spiral') return flightAccess(s, surfaces);
	const route = windingRoute(s),
		draw = projection(route.track, s, surfaces);
	return [
		...route.legs.flatMap((leg, i) => [draw.walk(leg, i), ...draw.frame(leg, i)]),
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
		if (!contains(draw.walk(leg, i))) return false;
	}
	return true;
}
