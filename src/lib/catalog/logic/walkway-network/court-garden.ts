import { courtLanding } from './court-landing';
import type { TerrainCell } from '../terrain-grid';
import { hashUnit } from '../../core/random';
import { houseSurfaces } from '../composed-house';
import type { Vec3, Primitive } from '../parametrik/types';
import { mountFitting } from './town-scatter';
import { courtLayout, type PublicSpace } from './court-life';

type Point = [number, number];
/** Extends the open court edge into the reserved mouth parcel as a raised garden.
 * The stair meets the opposite end of that edge. */
function edge(court: PublicSpace, mouth: Vec3) {
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
	const { a, b, x, y } = edges.sort((a, b) => a.reach - b.reach)[0];
	const width = Math.hypot(b[0] - a[0], b[1] - a[1]),
		ux = (b[0] - a[0]) / width,
		uy = (b[1] - a[1]) / width;
	const sign = Math.sign((x - cx) * uy - (y - cy) * ux);
	const point = (along: number, out: number): Point => [
		x + ux * along + sign * uy * out,
		y + uy * along - sign * ux * out
	];
	const landing: Vec3 = [...point(width / 2 - 1.25, 0), z];
	return { width, landing, a, b, point };
}

/** Admits a surveyed terrace only if the party, fitting and full-edge garden fit. */
export function furnishedCourt(cell: TerrainCell, mouth: TerrainCell, seed: number) {
	const court = courtLanding(cell);
	const { width, landing } = edge(court, mouth.center);
	return width >= 5.2 && !!courtLayout(court, seed, true, landing);
}

/** Projects the planted mouth edge and locates the stair on the clear side. */
export function courtGarden(court: PublicSpace, mouth: Vec3, seed: number) {
	const { a, b, width, point, landing } = edge(court, mouth);
	const z = court.position[2];
	const trees = ['cube-linden', 'terraced-cedar', 'coppice'];
	const id =
		trees[Math.floor(hashUnit(seed, court.id, 'garden-tree') * trees.length)] + '-park-tree-2p5m';
	const tree: Vec3 = [...point(-width / 2 + 1.65, 1.6), z - 0.3];
	const bed: Primitive = {
		kind: 'prism',
		id: court.id + '/garden/bed',
		role: 'neu',
		...houseSurfaces.food,
		material: 'concrete',
		finish: 'planted-mat',
		polygon: [a, b, point(width / 2, 3.2), point(-width / 2, 3.2)],
		z: z - 0.6,
		height: 0.3
	};
	return {
		landing,
		parts: [bed, ...mountFitting(id, 'low-crown', tree, court.id + '/garden', seed)]
	};
}
