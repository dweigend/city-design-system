import type { Body, Level, Point, Solid, Plan } from './types';
import { shaftCourses } from './shafts';
import { consolePlate } from './console';
import { hasFloor } from './courses';
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
			member('shaft', z + collar, rise - 2 * collar, size),
			member('head', top - collar, collar, size)
		];
	});
}
function bodySolid(b: Body, ground: number): Solid {
	const occupied = mounted(b, ground, b.kind === 'capsule' ? 'capsule' : 'body');
	if (b.objectId !== 'drum-house' && !b.objectId.startsWith('kit-crown-lantern-')) return occupied;
	return {
		...occupied,
		kind: 'cylinder',
		position: b.position,
		radius: b.size[0] / 2,
		height: b.size[2]
	};
}
function courtPlate(l: Level, plate: Solid): Solid {
	if (l.field)
		return {
			...plate,
			kind: 'prism',
			polygon: l.outline.map(([x, y]) => [x, y]),
			z: l.position[2] - plate.size[2],
			height: plate.size[2]
		};
	if (l.well)
		return {
			...plate,
			kind: 'prism',
			polygon: l.outline.map(([x, y]) => [x, y]),
			holes: [l.well.map(([x, y]) => [x, y])],
			z: l.position[2] - plate.size[2],
			height: plate.size[2]
		};
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
	const frames = ['bell-house', 'deck-tower', 'rack', 'twin-stack', 'plinth-house'];
	if (
		l.field ||
		prev?.field ||
		prev?.bodies.some((b) => b.objectId === 'kit-crown-lantern-2p5m') ||
		!frames.includes(plan.type)
	)
		return [];
	const edge = (d: Level) => d.position[1] - plan.sign * (d.depth / 2 - 0.15);
	const y = edge(prev ?? l);
	if (Math.abs(y - l.position[1]) + plan.bar / 2 > l.depth / 2 + 1e-9) return [];
	return bearings(plan, id + '/front', bottom, top, stations, y);
}
function tierBearings(
	plan: Plan,
	l: Level,
	prev: Level | undefined,
	stations: number[],
	id: string,
	below: number,
	top: number,
	full: boolean,
	i: number
) {
	const members = bearings(plan, id, below, top, stations) as Solid[];
	const base = prev
		? hasFloor(plan, Math.round((below - plan.datum) / STORY))
		: below === plan.site.ground;
	if (full && base) members.push(...frontBearings(plan, id, l, prev, below, top, stations));
	if (plan.datum + plan.site.programme.length * STORY - plan.site.ground >= 8)
		members.push(brace(plan, id + '/brace', stations, below, top, i % 2 === 1));
	return members;
}
function sockets(l: Level, z: number, ground: number) {
	return l.bodies.flatMap((b) => {
		const [w, d] = worldSize(b);
		const socket = [Math.min(w * 0.75, l.width * 0.7), Math.min(d * 0.75, l.depth * 0.65)];
		const center = (k: 0 | 1, span: number) =>
			l.position[k] +
			Math.sign(b.position[k] - l.position[k]) *
				Math.min(Math.abs(b.position[k] - l.position[k]), (span - socket[k]) / 2);
		return [
			solid(
				b.id + '/socket',
				'socket',
				[center(0, l.width), center(1, l.depth), z],
				[socket[0], socket[1], 0.12],
				ground,
				'frame'
			),
			bodySolid(b, ground)
		];
	});
}

function walkingPlate(
	plan: Plan,
	l: Level,
	full: boolean,
	plate: Solid,
	floor: ReturnType<typeof solid>
) {
	if (full) return courtPlate(l, plate);
	const landing = { ...floor, id: floor.id.replace(/deck$/, 'landing') };
	if (l.court) return courtPlate(l, landing);
	if (plan.type === 'cluster-mast' && !plan.site.compact) return landing;
	return consolePlate(plan, l, floor);
}
/** Articulates a course from its bearings to its occupied plate or console. */
export function tierParts(
	plan: Plan,
	l: Level,
	i: number,
	prev: Level | undefined,
	stations: number[],
	ratio: number,
	prefabricated = true
) {
	const below = prev?.position[2] ?? (l.position[2] > plan.datum ? plan.datum : plan.site.ground);
	const { site } = plan,
		id = site.id + '/level/' + i,
		[x, y, z] = l.position;
	const bodyVolume = l.bodies.reduce((sum, b) => sum + volume(b.size), 0);
	const thickness = Math.min(1.1, (bodyVolume * ratio) / l.deckArea);
	const floor = solid(
		id + '/deck',
		'deck',
		[x, y, z - thickness],
		[l.width, l.depth, thickness],
		site.ground,
		'deck'
	);

	const plate: Solid = l.round
		? {
				...floor,
				kind: 'cylinder',
				position: [x, y, z - thickness],
				radius: l.width / 2,
				height: thickness
			}
		: floor;
	const full = hasFloor(plan, Math.round((z - plan.datum) / STORY));
	const core = !prev && prefabricated ? shaftCourses(plan, l, stations, z - thickness) : undefined;
	const members = core ?? tierBearings(plan, l, prev, stations, id, below, z - thickness, full, i);
	const pieces = sockets(l, z, site.ground);
	return [...members, walkingPlate(plan, l, full, plate, floor), ...pieces];
}
