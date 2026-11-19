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

function stations(s: Section) {
	const { x, width: bayWidth } = s.composition.bay;
	const court = s.composition.levels[0].court;
	const span = court?.width ?? bayWidth;
	const path = housePath(s.typology);
	const count = Math.min(17, Math.floor((span - width) / going));
	const flank = ['core','cascade','external'].includes(path);
	const length = count * going;
	const left = x - (flank ? span - width : length) / 2;
	const sign = s.composition.accessSide === 'north' ? 1 : -1;
	const rear = court ? court.center[1] - sign*court.width/2 : roofLanding(s)[1];
	return [0,1].flatMap(lane => Array.from({length: count+1}, (_,i) => ({
		x: left + (lane ? count-i : i)*going,
		y: rear + sign * (0.5 + lane)*width,
		turn: i === count
	})));
}

/** Surveys a continuous switchback of rigid treads and level half-landings. */
export function flightRoute(s: Section) {
	const track = stations(s), legs: Leg[] = [], stops: Vec3[] = [];
	const doors = [roofLanding(s), ...s.composition.levels.map(l => l.landing).reverse()];
	let index = 0, z = s.top;
	const point = (): Vec3 => [track[index].x,track[index].y,z];
	function advance(drop: number, flight: number) {
		const from = point();
		index = (index+1) % track.length;
		z -= drop;
		legs.push({from, to: point(), flight, steps: Number(drop !== 0), kind: drop ? 'stairs' : 'landing'});
	}
	function descend(target: number, flight: number) {
		const count = Math.max(1, Math.round((z-target)/rise));
		const step = (z-target)/count;
		for (let i=0;i<count;i++) {
			if (track[index].turn) advance(0, flight);
			advance(step, flight);
		}
	}
	const docks = doors.map((door, i) => {
		if (i) descend(door[2],i-1);
		const station = point();
		stops.push(station);
		return {station,door};
	});
	descend(s.start ? s.base[2] : terrainHeight(s, point()), doors.length-1);
	stops.push(point());
	return { axis: s.stairAxis, width, legs, docks, stops };
}

function rectangle(a: Vec3, b: Vec3): [number, number][] {
	const dx = b[0] - a[0], dy = b[1] - a[1];
	const length = Math.hypot(dx, dy) || 1;
	const u = -dy * width / (2 * length), v = dx * width / (2 * length);
	return [[a[0]+u,a[1]+v],[a[0]-u,a[1]-v],[b[0]-u,b[1]-v],[b[0]+u,b[1]+v]];
}

/** Instantiates rigid straight treads and level connections to each landing. */
export function flightAccess(s: Section, surfaces: HouseSurfaces) {
	const route = flightRoute(s), id = s.id + '/stair/';
	const stock = (name: string, variant: string, deck: HouseSurfaces['deck']) => {
		const p = houseObject(name, variant, s.seed, { instanceId: id, slots: { deck, ...(name === 'stairs' ? { body: surfaces.frame } : {}) } }).parts[0];
		if (p.kind !== 'prism') throw Error('Expected stair plate');
		return p;
	};
	const tread = stock('stairs', 'straight-tread', surfaces.access);
	const plate = stock('landing', 'mast-platform', surfaces.deck);
	const platform = (from: Vec3, to: Vec3, key: string) => ({
		...plate, id: id + key, polygon: rectangle(from, to), z: from[2] - plate.height
	});
	const parts = route.legs.map(({ from, to, kind }, i) => {
		if (kind === 'landing') return platform(from, to, i + '/landing');
		const x = (to[0]+from[0])/2;
		return { ...tread, id: id + i + '/tread', z: to[2] - tread.height,
			polygon: tread.polygon.map(([u,v]): [number,number] => [x+u, from[1]+v]) };
	});
	return parts.concat(route.docks.map(({ station, door }, i) => platform(station, door, 'dock/' + i)));
}
