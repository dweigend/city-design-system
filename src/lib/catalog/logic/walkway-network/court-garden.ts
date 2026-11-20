import { hashUnit } from '../../core/random';
import { plantingSurfaces } from '../../data/planting-surfaces';
import { courtSurfaces } from './town-palette';
import { roundFootprint } from '../building-envelope';
import type { Vec3, Primitive } from '../parametrik/types';
import { mountFitting } from './town-scatter';
import type { PublicSpace } from './court-life';

type Point = [number, number];
/** Extends the open court edge into the reserved mouth parcel as a raised garden.
 * The public walk meets the clear side of that edge. */
function edge(court: PublicSpace, mouth: Vec3, side = false) {
	const {
		polygon,
		position: [cx, cy, z]
	} = court;
	const edges = polygon.map((a, i) => {
		const b = polygon[(i + 1) % polygon.length],
			x = (a[0] + b[0]) / 2,
			y = (a[1] + b[1]) / 2;
		return { a, b, x, y, reach: Math.hypot(x - mouth[0], y - mouth[1]) };
	});
	const front = edges.indexOf([...edges].sort((a, b) => a.reach - b.reach)[0]);
	const { a, b, x, y } = edges[(front + Number(side)) % edges.length];
	const width = Math.hypot(b[0] - a[0], b[1] - a[1]),
		ux = (b[0] - a[0]) / width,
		uy = (b[1] - a[1]) / width;
	const sign = Math.sign((x - cx) * uy - (y - cy) * ux);
	const point = (along: number, out: number): Point => [
		x + ux * along + sign * uy * out,
		y + uy * along - sign * ux * out
	];
	const landing: Vec3 = [...point(Math.min(4, width / 2 - 1.25), 0), z];
	return { width, landing, a, b, point };
}

// A continuous low hedge sits inside the long garden shoulder, clear of its ends.
function courtHedge(court: PublicSpace, side: ReturnType<typeof edge>, level: number): Primitive[] {
	if (court.area < 144) return [];
	const run = side.width * 0.68;
	const count = Math.max(2, Math.ceil(run / 1.3));
	return Array.from({ length: count }, (_, i) => ({
		id: court.id + '/garden/hedge/' + i,
		...plantingSurfaces.foliage,
		kind: 'dome',
		edges: false,
		radius: 0.86,
		height: 0.62,
		position: [...side.point(run * (i / (count - 1) - 0.5), 2.58), level - 0.03]
	}));
}

/** Projects the planted mouth edge and locates the walking port on the clear side. */
export function courtGarden(
	court: PublicSpace,
	mouth: Vec3,
	seed: number,
	ground: (x: number, y: number) => number,
	relief: (x: number, y: number) => number
) {
	const open = edge(court, mouth);
	const { landing } = open;
	const side = edge(court, mouth, court.area >= 144);
	const { a, b, width, point } = side;
	const z = court.position[2];
	const trees = ['cube-linden', 'terraced-cedar', 'coppice'];
	const id =
		trees[Math.floor(hashUnit(seed, court.id, 'garden-tree') * trees.length)] + '-park-tree-2p5m';
	const count = court.area >= 144 ? 3 + Math.floor(2 * hashUnit(seed, court.id, 'tree-count')) : 1;
	// One turf shoulder carries the whole grove. Its narrow ends return to
	// the court edge and its bowed outer edge continues the district lawn.
	const shoulder = roundFootprint(
		[
			point(-width / 2, 0.9),
			point(width / 2, 0.9),
			point(width / 2, 2.6),
			point(width * 0.29, 4.0),
			point(0, 4.6),
			point(-width * 0.29, 4.0),
			point(-width / 2, 2.6)
		],
		1.8
	);
	const level = Math.max(
		z - 0.12,
		ground(...point(0, 2)),
		Math.min(z + 0.3, relief(...point(0, 2)))
	);
	const base = Math.min(level, ...shoulder.map((p) => ground(...p))) - 0.04;
	const soil: Primitive = {
		kind: 'prism',
		id: court.id + '/garden/soil',
		...courtSurfaces.lawn,
		edges: false,
		polygon: shoulder,
		z: base,
		height: level - base
	};
	const grove = Array.from({ length: count }, (_, i) => {
		const along = width * ((i + 0.5) / count - 0.5);
		const tree: Vec3 = [...point(along, 1.8), level];
		return mountFitting(id, 'low-crown', tree, court.id + '/garden/' + i, seed);
	}).flat();
	const rim = [a, b, point(width / 2, 0.9), point(-width / 2, 0.9)];
	const bottom = Math.min(z - 0.6, ...rim.map((p) => ground(...p))) - 0.04;
	const bed: Primitive = {
		kind: 'prism',
		id: court.id + '/garden/bed',
		role: 'neu',
		token: courtSurfaces.rim.token,
		edges: false,
		material: 'concrete',
		finish: 'beton-terrazzo',
		polygon: rim,
		z: bottom,
		height: z - 0.15 - bottom
	};
	return {
		landing,
		heading: Math.atan2(
			open.point(0, 1)[1] - open.point(0, 0)[1],
			open.point(0, 1)[0] - open.point(0, 0)[0]
		),
		parts: [bed, soil, ...grove, ...courtHedge(court, side, level)]
	};
}
