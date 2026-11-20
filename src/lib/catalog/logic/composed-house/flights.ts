import { flightRail } from './flight-rail';
import { treadSpine, pairedTreads, type Station } from './stair-track';
import { flightStations } from './flight-stations';
import type { Vec3 } from '../parametrik/types';
import { roofLanding } from './roof-landing';
import { terrainHeight } from './ground';
import { houseObject } from './house-object';
import { roleSurface, type HouseSurfaces } from './surfaces';
import type { Section } from './types';

type Leg = {
	from: Vec3;
	to: Vec3;
	kind: 'stairs' | 'landing';
	steps: number;
	flight: number;
	ends: [Station, Station];
};

/** Surveys a continuous switchback of rigid treads and level half-landings. */
export function flightRoute(s: Section) {
	const track = flightStations(s),
		legs: Leg[] = [],
		stops: Vec3[] = [];
	const doors = [roofLanding(s), ...s.composition.levels.map((l) => l.landing).reverse()];
	let index = 0,
		z = s.top;
	const point = (): Vec3 => [track[index].x, track[index].y, z];
	function advance(drop: number, flight: number) {
		const from = point(),
			start = track[index].station;
		index = (index + 1) % track.length;
		z -= drop;
		legs.push({
			from,
			ends: [start, track[index].station],
			to: point(),
			flight,
			steps: Number(drop !== 0),
			kind: drop ? 'stairs' : 'landing'
		});
	}
	function descend(target: number, flight: number) {
		const count = Math.max(1, Math.round((z - target) / 0.18));
		const step = (z - target) / count;
		for (let i = 0; i < count; i++) {
			if (track[index].turn) advance(0, flight);
			advance(step, flight);
		}
	}
	const docks = doors.map((door, i) => {
		if (i) descend(door[2], i - 1);
		const station = point();
		stops.push(station);
		return { station, door };
	});
	descend(s.start ? s.base[2] : terrainHeight(s, point()), doors.length - 1);
	stops.push(point());
	return { axis: s.stairAxis, width: s.composition.flightWidth, legs, docks, stops };
}

function rectangle(a: Vec3, b: Vec3, width: number): [number, number][] {
	const dx = b[0] - a[0],
		dy = b[1] - a[1];
	const length = Math.hypot(dx, dy) || 1;
	const u = (-dy * width) / (2 * length),
		v = (dx * width) / (2 * length);
	return [
		[a[0] + u, a[1] + v],
		[a[0] - u, a[1] - v],
		[b[0] - u, b[1] - v],
		[b[0] + u, b[1] + v]
	];
}

function roofBypass(s: Section, station: Vec3, door: Vec3): Vec3[] {
	const width = s.composition.flightWidth;
	const bodies = s.composition.levels[s.composition.levels.length - 1].bodies;
	const b = bodies[0],
		halfWidth =
			(Math.abs(Math.cos(b.rotation)) * b.size[0] + Math.abs(Math.sin(b.rotation)) * b.size[1]) / 2;
	const flank =
		b.position[0] + (station[0] < b.position[0] ? -1 : 1) * (halfWidth + width / 2 + 0.02);
	const dy = door[1] - b.position[1],
		halfDepth =
			(Math.abs(Math.sin(b.rotation)) * b.size[0] + Math.abs(Math.cos(b.rotation)) * b.size[1]) / 2;
	const cross =
		b.position[1] + Math.sign(dy) * Math.max(Math.abs(dy), halfDepth + width / 2 + 0.02);
	return [
		station,
		[flank, station[1], door[2]],
		[flank, cross, door[2]],
		[door[0], cross, door[2]],
		door
	];
}
/** Instantiates rigid straight treads and level connections to each landing. */
export function flightAccess(s: Section, surfaces: HouseSurfaces) {
	const { flightWidth: width } = s.composition;
	const route = flightRoute(s),
		id = s.id + '/stair/';
	const stock = (name: string, variant: string, deck: HouseSurfaces['deck']) => {
		const p = houseObject(name, variant, s.seed, {
			instanceId: id,
			slots: { deck, ...(name === 'stairs' ? { body: surfaces.frame } : {}) }
		}).parts[0];
		if (p.kind !== 'prism') throw Error('Expected stair plate');
		return p;
	};
	const tread = stock('stairs', 'straight-tread', roleSurface(surfaces.access, 'deck'));
	const plate = stock('landing', 'mast-platform', surfaces.deck);
	const platform = (from: Vec3, to: Vec3, key: string) => ({
		...plate,
		structuralRole: 'cantilever' as const,
		id: id + key,
		polygon: rectangle(from, to, width),
		height: 0.12,
		z: from[2] - 0.12
	});
	const spine = stock('landing', 'mast-platform', surfaces.frame);
	const treads = route.legs.flatMap((leg, i) => {
		const { to, kind, ends } = leg;
		const [a, b] = ends;
		const stock = kind === 'landing' ? plate : tread;
		return [
			...pairedTreads(
				stock,
				id + i + '/' + (kind === 'landing' ? 'landing' : 'tread'),
				a,
				b,
				to[2]
			),
			treadSpine(spine, id + i, a, b, to[2])
		];
	});
	const walk = [
		...treads,
		...route.docks.flatMap(({ station, door }, i) => {
			const knee: Vec3 = [door[0], station[1], door[2]];
			const path =
				i === 0 && s.typology === 'cluster-mast'
					? roofBypass(s, station, door)
					: [station, knee, door];
			return path
				.slice(1)
				.flatMap((b, j) =>
					Math.hypot(b[0] - path[j][0], b[1] - path[j][1]) > 0.01
						? [platform(path[j], b, 'dock/' + i + '/' + j)]
						: []
				);
		})
	];
	return [
		...walk,
		...flightRail(
			s,
			[
				{ station: route.legs[0].ends[0], z: route.legs[0].from[2] },
				...route.legs.map((l) => ({ station: l.ends[1], z: l.to[2] }))
			],
			width,
			surfaces,
			walk
		)
	];
}
