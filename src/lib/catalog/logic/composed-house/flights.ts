import { houseStair } from '../../data/house-stair';
import type { Vec3 } from '../parametrik/types';
import { roofLanding } from './roof-landing';
import { terrainHeight } from './ground';
import { houseObject } from './house-object';
import type { HouseSurfaces } from './surfaces';
import type { Section } from './types';

type Leg = { from: Vec3; to: Vec3; kind: 'stairs' | 'landing'; steps: number; flight: number };
const { going, rise, width } = houseStair;

function flightEdge(s: Section, sign: number) {
	const bay = s.composition.bay;
	if (s.typology === 'cluster-mast') {
		const edges = s.composition.levels.flatMap((l) =>
			l.bodies.map(
				(b) =>
					sign * b.position[1] +
					(Math.abs(Math.sin(b.rotation)) * b.size[0] +
						Math.abs(Math.cos(b.rotation)) * b.size[1]) /
						2
			)
		);
		return sign * Math.min(sign * bay.y + bay.depth / 2 - 2 * width, Math.max(...edges) + 0.01);
	}
	return roofLanding(s)[1];
}
function stations(s: Section) {
	const { x, width: bayWidth } = s.composition.bay;
	const court = s.composition.levels[0].court;
	const span = court?.width ?? bayWidth;
	const path = s.composition.path;
	const count = Math.min(17, Math.floor((span - width) / going));
	const flank = ['core', 'cascade', 'external'].includes(path);
	const length = count * going;
	const left =
		path === 'cascade' ? x + (span - width) / 2 - length : x - (flank ? span - width : length) / 2;
	const sign = s.composition.accessSide === 'north' ? 1 : -1;
	const rear = court ? court.center[1] - (sign * court.width) / 2 : flightEdge(s, sign);
	return [0, 1].flatMap((lane) =>
		Array.from({ length: count + 1 }, (_, i) => ({
			x: left + (lane ? count - i : i) * going,
			y: rear + sign * (0.5 + lane) * width,
			turn: i === count
		}))
	);
}

/** Surveys a continuous switchback of rigid treads and level half-landings. */
export function flightRoute(s: Section) {
	const track = stations(s),
		legs: Leg[] = [],
		stops: Vec3[] = [];
	const doors = [roofLanding(s), ...s.composition.levels.map((l) => l.landing).reverse()];
	let index = 0,
		z = s.top;
	const point = (): Vec3 => [track[index].x, track[index].y, z];
	function advance(drop: number, flight: number) {
		const from = point();
		index = (index + 1) % track.length;
		z -= drop;
		legs.push({
			from,
			to: point(),
			flight,
			steps: Number(drop !== 0),
			kind: drop ? 'stairs' : 'landing'
		});
	}
	function descend(target: number, flight: number) {
		const count = Math.max(1, Math.round((z - target) / rise));
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
	return { axis: s.stairAxis, width, legs, docks, stops };
}

function rectangle(a: Vec3, b: Vec3): [number, number][] {
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
	const tread = stock('stairs', 'straight-tread', surfaces.access);
	const plate = stock('landing', 'mast-platform', surfaces.deck);
	const platform = (from: Vec3, to: Vec3, key: string) => ({
		...plate,
		id: id + key,
		polygon: rectangle(from, to),
		z: from[2] - plate.height
	});
	const cheek = houseObject('stairs', 'short-flight', s.seed, {
		instanceId: id,
		slots: { deck: surfaces.access, body: surfaces.frame }
	}).parts[0];
	if (cheek.kind !== 'box') throw Error('Expected rectangular stair section');
	const stringers = route.legs.flatMap(({ from, to, kind }, i) =>
		kind === 'stairs'
			? [
					{
						...cheek,
						id: id + i + '/stringer',
						position: [Math.min(from[0], to[0]), from[1] + width / 2 - 0.3, to[2] - 0.3] as Vec3,
						size: [going, 0.3, 0.3] as Vec3
					}
				]
			: []
	);
	const parts = route.legs.map(({ from, to, kind }, i) => {
		if (kind === 'landing') return platform(from, to, i + '/landing');
		const x = (to[0] + from[0]) / 2;
		return {
			...tread,
			id: id + i + '/tread',
			z: to[2] - tread.height,
			polygon: tread.polygon.map(([u, v]): [number, number] => [x + u, from[1] + v])
		};
	});
	return [
		...parts,
		...stringers,
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
}
