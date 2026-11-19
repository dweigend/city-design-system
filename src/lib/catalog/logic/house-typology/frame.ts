import type { Body, Level, Point, Solid, Plan } from './types';
import { brace } from './brace';
import { STORY } from '../../data/grid';
import { solid, worldSize, mounted } from './objects';
const volume = ([w, d, h]: Point) => w * d * h;

/** Transfers each storey load through articulated bearings on the outer edge of the access band. */
export function bearings(
	plan: Plan,
	id: string,
	z: number,
	top: number,
	stations: number[],
	y = plan.rear - plan.sign * 0.15
) {
	const rise = top - z,
		collar = Math.min(0.16, rise / 4);
	return stations.flatMap((x, i) => {
		const address = id + '/post/' + i;
		const size = plan.bar;
		const member = (name: 'foot' | 'shaft' | 'head', at: number, height: number, width: number) =>
			solid(
				address + '/' + name,
				name,
				[x, y, at],
				[plan.type === 'slab-house' ? 1.1 : width, width, height],
				plan.site.ground,
				'frame'
			);
		return [
			member('foot', z, collar, size),
			member('shaft', z + collar, rise - 2 * collar, size * 0.72),
			member('head', top - collar, collar, size)
		];
	});
}
function bodySolid(b: Body, ground: number): Solid {
	const occupied = mounted(b, ground, b.kind === 'capsule' ? 'capsule' : 'body');
	if (b.objectId !== 'drum-house') return occupied;
	return {
		...occupied,
		kind: 'cylinder',
		position: b.position,
		radius: b.size[0] / 2,
		height: b.size[2]
	};
}
function courtPlate(l: Level, plate: Solid): Solid {
	if (!l.court || plate.kind !== 'box' || !l.court.width) return plate;
	const {
			center: [x, y],
			width
		} = l.court,
		r = width / 2;
	return {
		...plate,
		kind: 'prism',
		z: plate.position[2],
		height: plate.size[2],
		polygon: l.outline.map(([u, v]) => [u, v]),
		holes: [
			[
				[x - r, y - r],
				[x - r, y + r],
				[x + r, y + r],
				[x + r, y - r]
			]
		]
	};
}
function frontBearings(
	plan: Plan,
	id: string,
	l: Level,
	prev: Level | undefined,
	bottom: number,
	top: number,
	stations: number[]
) {
	const frames = [
		'bell-house',
		'deck-tower',
		'portal-house',
		'bridge-house',
		'rack',
		'twin-stack',
		'plinth-house'
	];
	if (!frames.includes(plan.type)) return [];
	const edge = (d: Level) => d.position[1] - plan.sign * (d.depth / 2 - 0.15);
	const y = edge(prev ?? l);
	if (Math.abs(y - l.position[1]) + plan.bar / 2 > l.depth / 2 + 1e-9) return [];
	return bearings(plan, id + '/front', bottom, top, stations, y);
}
export function tierParts(
	plan: Plan,
	l: Level,
	i: number,
	prev: Level | undefined,
	stations: number[],
	ratio: number
) {
	const below = prev?.position[2] ?? plan.site.ground;
	const { site } = plan,
		id = site.id + '/level/' + i,
		[x, y, z] = l.position;
	const bodyVolume = l.bodies.reduce((sum, b) => sum + volume(b.size), 0);
	const thickness = Math.min(0.55, (bodyVolume * ratio) / l.deckArea);
	const floor = solid(
		id + '/deck',
		'deck',
		[x, y, z - thickness],
		[l.width, l.depth, thickness],
		site.ground,
		'deck'
	);
	const posts = bearings(plan, id, below, z - thickness, stations);
	const plate: Solid = l.round
		? {
				...floor,
				kind: 'cylinder',
				position: [x, y, z - thickness],
				radius: l.width / 2,
				height: thickness
			}
		: floor;
	const members: Solid[] = [
		...posts,
		...frontBearings(plan, id, l, prev, below, z - thickness, stations)
	];
	if (plan.datum + site.programme.length * STORY - site.ground >= 8)
		members.push(brace(plan, id + '/brace', stations, below, z - thickness, i % 2 === 1));
	const pieces = l.bodies.flatMap((b) => {
		const [w, d] = worldSize(b);
		return [
			solid(
				b.id + '/socket',
				'socket',
				[b.position[0], b.position[1], z],
				[w * 0.75, d * 0.75, 0.12],
				site.ground,
				'frame'
			),
			bodySolid(b, site.ground)
		];
	});
	return [...members, courtPlate(l, plate), ...pieces];
}
