import type { Vec3 } from '../parametrik/types';
import { roofLanding } from './roof-landing';
import { terrainHeight } from './ground';
import { houseObject, type HousePart } from './house-object';
import type { Section } from './types';
import type { HouseSurfaces } from './surfaces';

function blockFoot(s: Section) {
	const sign = s.composition.accessSide === 'north' ? 1 : -1;
	const bay = s.composition.bay;
	const rear = Math.max(
		...s.composition.levels.flatMap((l) =>
			l.bodies.map((b) => sign * (b.position[1] - bay.y) + b.size[1] / 2)
		)
	);
	const target = Math.max(s.depth / 2 + 0.535, rear + 0.635);
	if (s.cells.length !== 1) return bay.y + sign * (s.depth / 2 + 0.535);
	const cap = s.cells[0].corners.reduce((limit, [u, v], i, ring) => {
		const [a, b] = ring[(i + 1) % ring.length],
			dx = a - u,
			dy = b - v;
		if (dx * sign >= -1e-8) return limit;
		return Math.min(
			limit,
			(dx * (bay.y - v) - dy * (bay.x - u) - Math.abs(dy) * 0.31 + 0.535 * Math.hypot(dx, dy)) /
				(-dx * sign)
		);
	}, target);
	return bay.y + sign * cap;
}
/** Locates successive ladder feet on the surveyed facade, from crown to terrain. */
export function mastRoute(s: Section) {
	const [x, y] = s.stairAxis;
	const doors = [roofLanding(s), ...[...s.composition.levels].reverse().map((d) => d.landing)];
	const stops = doors.map((d): Vec3 => [x, y, d[2]]);
	const groundY =
		s.typology === 'block' && !s.composition.levels[0].bodies[0].band?.footprint ? blockFoot(s) : y;
	stops.push([x, groundY, s.start ? s.base[2] : terrainHeight(s, [x, groundY, 0])]);
	const rests: Vec3[] = [];
	const legs = stops.slice(1).flatMap((end, flight) => {
		const start = stops[flight];
		const count = Math.max(1, Math.ceil(Math.abs(end[2] - start[2]) / 4));
		const station = (i: number): Vec3 =>
			i === 0
				? start
				: i === count
					? end
					: (start.map((v, k) => v + ((end[k] - v) * i) / count) as Vec3);
		return Array.from({ length: count }, (_, i) => {
			const from = station(i),
				to = station(i + 1);
			if (i) rests.push(from);
			return { from, to, kind: 'ladder' as const, flight, steps: 0 };
		});
	});
	return {
		axis: s.stairAxis,
		width: s.typology === 'block' ? 0.48 : 0.62,
		rests,
		stops,
		legs,
		docks: doors.map((door, i) => ({ door, station: stops[i] }))
	};
}

/** Fits rigid rungs between continuous stiles, with a side landing at each deck opening. */
export function mastAccess(s: Section, surfaces: HouseSurfaces): HousePart[] {
	const id = s.id + '/stair/',
		route = mastRoute(s);
	const stock = houseObject('ladder', 'rung-bay', s.seed, {
		instanceId: id + 'ladder',
		slots: { body: surfaces.frame }
	}).parts;
	const plate = houseObject('landing', 'mast-platform', s.seed, {
		instanceId: id + 'landing',
		slots: { deck: surfaces.deck }
	}).parts[0];
	if (plate.kind !== 'prism') throw new Error('Expected ladder landing');
	const sign = s.composition.accessSide === 'north' ? 1 : -1;
	const extra = route.rests.map(([x, y, z]) => ({
		door: [
			x,
			y -
				(s.typology === 'tree-house' ? 1 : sign) *
					(s.typology === 'block'
						? Math.abs(y - s.composition.bay.y) > s.depth / 2
							? 0.1
							: 0.32
						: s.typology === 'cluster-mast' && !s.composition.compact
							? 0.42
							: 0.6),
			z
		] as Vec3,
		station: [x, y, z] as Vec3
	}));
	const landings = [...route.docks, ...extra].map(({ door: [dx, dy, z], station: [x, y] }, i) => ({
		...plate,
		structuralRole: 'cantilever' as const,
		id: id + 'landing/' + i,
		height: 0.12,
		z: z - 0.12,
		polygon: plate.polygon.map(([u, v]): [number, number] => [
			(Math.sign(u) * route.width) / 2 + (v < 0 ? dx : x),
			v < 0 ? dy : y
		])
	}));
	const rung = houseObject('ladder', 'rung-bay', s.seed, {
		instanceId: id + 'rung',
		slots: { body: surfaces.access }
	}).parts[0];
	const flights = route.legs.flatMap(({ from, to }, i) => {
		const height = from[2] - to[2],
			count = Math.max(1, Math.round(height / 0.28));
		return stock.flatMap((p, j) => {
			if (p.kind !== 'pipe') throw new Error('Expected ladder rail');
			const copies = j === 0 ? count : 1;
			return Array.from({ length: copies }, (_, k) => ({
				...(j === 0 ? rung : p),
				structuralRole: 'cantilever' as const,
				radius: 0.06,
				id: id + (j === 0 ? 'rung/' : 'ladder/') + i + '/' + j + '/' + k,
				points: p.points.map(([, u, v]): Vec3 => [
					to[0] +
						u * (route.width / 0.62) +
						(from[0] - to[0]) * (j === 0 ? (k + 1) / count : v / 0.28),
					to[1] + (from[1] - to[1]) * (j === 0 ? (k + 1) / count : v / 0.28),
					to[2] + (j === 0 ? (k + 1) / count : v / 0.28) * height
				])
			}));
		});
	});
	const rail = stock[1];
	if (rail.kind !== 'pipe') throw new Error('Expected ladder stile');
	const hoops =
		s.typology === 'block'
			? []
			: route.legs.flatMap(({ from, to }, i) => {
					const n = Math.max(1, Math.ceil(Math.abs(from[2] - to[2]) / 1.2));
					return Array.from({ length: n }, (_, j) => ({
						...rail,
						structuralRole: 'cantilever' as const,
						id: id + 'cage/' + i + '/' + j,
						radius: 0.06,
						points: Array.from({ length: 9 }, (_, k): Vec3 => {
							const angle = (k * Math.PI) / 8;
							return [
								to[0] + ((from[0] - to[0]) * (j + 0.5)) / n + 0.34 * Math.cos(angle),
								to[1] + sign * 0.34 * Math.sin(angle),
								to[2] + ((from[2] - to[2]) * (j + 0.5)) / n
							];
						})
					}));
				});
	return [...landings, ...flights, ...hoops];
}
