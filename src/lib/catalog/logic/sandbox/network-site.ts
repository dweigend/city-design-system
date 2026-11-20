import { houseStair } from '../../data/house-stair';
import { circulation, type HouseObstacle, type planHouse } from '../composed-house';
import type { NetworkInput } from '../walkway-network';
import { required } from '../required';

type Section = ReturnType<typeof planHouse>;
type Point = NetworkInput['houses'][number]['entrance'];

/** Converts the composition's body envelopes to bottom-centred world boxes. */
export function bodyObstacles(section: Section): HouseObstacle[] {
	return section.composition.parts.flatMap((part) => {
		if (part.joint !== 'body' && part.joint !== 'capsule') return [];
		if (part.kind === 'prism') {
			const b = planBounds(part.polygon);
			const position: HouseObstacle['position'] = [
				(b.left + b.right) / 2,
				(b.bottom + b.top) / 2,
				part.z
			];
			return [{ position, size: part.size, owner: section.id }];
		}
		if (part.kind !== 'box' && part.kind !== 'cylinder') return [];
		const [u, v, z] = part.position,
			[w, d] = part.size;
		const center: HouseObstacle['position'] =
			part.kind === 'box' ? [u + w / 2, v + d / 2, z] : [u, v, z];
		return [{ position: center, size: part.size, owner: section.id }];
	});
}

/** Surveys the circulation foot and its approach beneath elevated cabin edges. */
export function networkHouse(section: Section) {
	const [x, y] = required(circulation(section).stops.at(-1), 'ground entrance');
	const entrance: Point = [x, y];
	const ground = Math.max(...section.cells.flatMap((c) => c.corners.map((p) => p[2])));
	const obstacles: HouseObstacle[] = [],
		overhangs: Point[][] = [];
	for (const body of bodyObstacles(section)) {
		if (
			section.composition.levels[0].bodies[0].band?.footprint &&
			body.position[2] - ground >= 2.1 + houseStair.thickness
		)
			continue;
		const exclusion = entranceApron(body, entrance, ground);
		if (exclusion) overhangs.push(exclusion);
		else obstacles.push(body);
	}
	return { id: section.id, entrance, obstacles, overhangs };
}

/** Axis-aligned bounds of a set of plan points in metres. */
export function planBounds(points: readonly (readonly number[])[]) {
	const xs = points.map((p) => p[0]),
		ys = points.map((p) => p[1]);
	return {
		left: Math.min(...xs),
		right: Math.max(...xs),
		bottom: Math.min(...ys),
		top: Math.max(...ys)
	};
}
type Bounds = ReturnType<typeof planBounds>;
/** Includes cells touching the survey window, including at a shared edge. */
export function overlaps(a: Bounds, b: Bounds) {
	return a.left <= b.right && a.right >= b.left && a.bottom <= b.top && a.top >= b.bottom;
}

/** Plan extents of a bottom-centred occupied volume. */
export function bodyBounds({ position: [x, y], size: [w, d] }: HouseObstacle): Bounds {
	return { left: x - w / 2, right: x + w / 2, bottom: y - d / 2, top: y + d / 2 };
}

// The last approach to a facade can use its one-metre setback. Reserve the whole
// physical footprint unless a door-height overhang can accept the decking edge.
function entranceApron(body: HouseObstacle, [x, y]: Point, ground: number) {
	const [u, v, z] = body.position,
		[w, d] = body.size;
	const distance = Math.max(Math.abs(x - u) - w / 2, Math.abs(y - v) - d / 2);
	const half = houseStair.width / 2;
	if (distance >= 1 + half) return;
	// Against a low facade the entire width must still clear the body.
	if (distance < half && z - ground - houseStair.thickness < 2.1) return;
	const inset = Math.max(0, half - distance + 1e-7);
	if (distance < 0 || Math.min(w, d) <= 2 * inset) return;
	const { left, right, bottom, top } = bodyBounds(body);
	const ring: Point[] = [
		[left + inset, bottom + inset],
		[right - inset, bottom + inset],
		[right - inset, top - inset],
		[left + inset, top - inset]
	];
	return ring;
}
