import type { Vec3 } from '../parametrik/types';
import { roofLanding } from './deck-plan';
import { terrainHeight } from './ground';
import { houseObject, type HousePart } from './house-object';
import type { Section } from './types';
import type { HouseSurfaces } from './surfaces';

/** Locates successive ladder feet on the surveyed facade, from crown to terrain. */
export function mastRoute(s: Section) {
	const [x, y] = s.stairAxis;
	const doors = [
		roofLanding(s),
		...[...s.composition.levels].reverse().map(d => d.landing)
	];
	const stops = doors.map((d): Vec3 => [x, y, d[2]]);
	stops.push([x, y, s.start ? s.base[2] : terrainHeight(s, [x, y, 0])]);
	const legs = stops.slice(1).map((to, i) => ({
		from: stops[i],
		to,
		kind: 'ladder' as const,
		flight: i,
		steps: 0
	}));
	return {
		axis: s.stairAxis,
		width: 0.62,
		stops,
		legs,
		docks: doors.map((door, i) => ({ door, station: stops[i] }))
	};
}

/** Fits rigid rungs between continuous stiles, with a side landing at each deck opening. */
export function mastAccess(s: Section, surfaces: HouseSurfaces): HousePart[] {
	const id = s.id + '/stair/',
		route = mastRoute(s),
		[x, y] = route.axis;
	const stock = houseObject('ladder', 'rung-bay', s.seed, {
		instanceId: id + 'ladder',
		slots: { body: surfaces.frame }
	}).parts;
	const plate = houseObject('landing', 'mast-platform', s.seed, {
		instanceId: id + 'landing',
		slots: { deck: surfaces.deck }
	}).parts[0];
	if (plate.kind !== 'prism') throw new Error('Expected ladder landing');
	const landings = route.docks.map(({ door: [dx, dy, z] }, i) => ({
		...plate,
		id: id + 'landing/' + i,
		z: z - plate.height,
		polygon: plate.polygon.map(([u, v]): [number, number] => [
			u * 0.62 + (v < 0 ? dx : x),
			v < 0 ? dy : y
		])
	}));
	const flights = route.legs.flatMap(({ from, to }, i) => {
		const height = from[2] - to[2],
			count = Math.max(1, Math.round(height / 0.28));
		return stock.flatMap((p, j) => {
			if (p.kind !== 'pipe') throw new Error('Expected ladder rail');
			const copies = j === 0 ? count : 1;
			return Array.from({ length: copies }, (_, k) => ({
				...p,
				id: id + 'ladder/' + i + '/' + j + '/' + k,
				points: p.points.map(([u, , v]): Vec3 => [
					x + u,
					y,
					to[2] + (j === 0 ? (k + 1) / count : v / 0.28) * height
				])
			}));
		});
	});
	return [...landings, ...flights];
}
