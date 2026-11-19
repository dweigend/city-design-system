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
		const exclusion = entranceOverhang(body, entrance, ground);
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

/** Rectangle in plan for a bottom-centred occupied volume. */
export function outline({ position: [x, y], size: [w, d] }: HouseObstacle): Point[] {
	return [
		[x - w / 2, y - d / 2],
		[x + w / 2, y - d / 2],
		[x + w / 2, y + d / 2],
		[x - w / 2, y + d / 2]
	];
}

// An elevated cabin can overhang a mast entrance. Keep its projection outside the
// walking line, allowing only the deck edge under it when there is door-height clearance.
function entranceOverhang(body: HouseObstacle, [x, y]: Point, ground: number) {
	const [u, v, z] = body.position,
		[w, d] = body.size;
	const distance = Math.max(Math.abs(x - u) - w / 2, Math.abs(y - v) - d / 2);
	const half = houseStair.width / 2;
	if (z - ground < 2.1 || distance >= 1 + half) return;
	const inset = Math.max(0, half - distance + 1e-7);
	if (distance < 0 || Math.min(w, d) <= 2 * inset) return;
	return outline({ ...body, size: [w - 2 * inset, d - 2 * inset, body.size[2]] });
}
