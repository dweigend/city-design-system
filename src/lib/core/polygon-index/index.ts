/** Module: Finds points and directed segments in a fixed set of polygon contours. */
import type { Vec2 } from '../geometry';
import { bounds, contains, entry, overlaps, type Bounds } from './contour';

type Polygon = Readonly<{ id: string; outline: readonly Vec2[] }>;
type Leaf<T> = { box: Bounds; order: number; polygon: T; outline: readonly Vec2[] };
type Tree<T> = Leaf<T> | { box: Bounds; left: Tree<T>; right: Tree<T> };

function tree<T>(leaves: Leaf<T>[]): Tree<T> {
	if (leaves.length === 1) return leaves[0];
	const box = bounds(leaves.flatMap(({ box: { min, max } }) => [min, max]));
	const axis = box.max[0] - box.min[0] >= box.max[1] - box.min[1] ? 0 : 1;
	leaves.sort((a, b) => a.box.min[axis] + a.box.max[axis] - b.box.min[axis] - b.box.max[axis]);
	const middle = Math.floor(leaves.length / 2);
	return { box, left: tree(leaves.slice(0, middle)), right: tree(leaves.slice(middle)) };
}

function intersect<T>(node: Tree<T>, box: Bounds, margin: number, matches: Leaf<T>[]) {
	if (!overlaps(node.box, box, margin)) return;
	if ('polygon' in node) matches.push(node);
	else {
		intersect(node.left, box, margin, matches);
		intersect(node.right, box, margin, matches);
	}
}

// Exact arithmetic: a simple polygon needs at least three vertices.
/** Builds a bounding-volume index over simple XY polygon rings. Input order breaks edge,
 * corner and overlap ties. The margin in meters applies to point containment. */
export function createPolygonIndex<T extends Polygon>(
	polygons: readonly T[],
	marginM = /* Exact arithmetic: zero margin leaves bounds unchanged. */ 0
) {
	if (!Number.isFinite(marginM) || marginM < 0) throw new RangeError('Invalid polygon margin');
	const ids = new Set<string>();
	const leaves = polygons.map((polygon, order) => {
		if (
			!polygon.id ||
			ids.has(polygon.id) ||
			polygon.outline.length < 3 ||
			polygon.outline.some((point) => !point.every(Number.isFinite))
		)
			throw new RangeError('Invalid polygon: ' + polygon.id);
		ids.add(polygon.id);
		const outline = polygon.outline.map(([x, y]): Vec2 => [x, y]);
		return { polygon, order, outline, box: bounds(outline) };
	});
	const root = leaves.length ? tree(leaves) : undefined;

	function candidates(points: readonly Vec2[], margin = marginM) {
		const matches: Leaf<T>[] = [];
		if (root) intersect(root, bounds(points), margin, matches);
		return matches;
	}

	return Object.freeze({
		/** Reads polygons whose XY bounds overlap the bounds of the points, in input order.
		 * Use this when the caller owns the exact geometry and boundary rules. */
		readCandidates(points: readonly Vec2[]): readonly T[] {
			return candidates(points, /* Exact arithmetic: exact box overlap without margin. */ 0)
				.sort((a, b) => a.order - b.order)
				.map(({ polygon }) => polygon);
		},
		/** Reads the first containing polygon, including its edge and corners. */
		readPoint(point: Vec2): T | undefined {
			return candidates([point])
				.sort((a, b) => a.order - b.order)
				.find(({ outline }) => contains(outline, point, marginM))?.polygon;
		},
		/** Reads intersected polygons once each, ordered by entry along the segment. */
		readSegment(from: Vec2, to: Vec2): readonly T[] {
			return candidates([from, to])
				.map((leaf) => ({ ...leaf, hit: entry(leaf.outline, from, to, marginM) }))
				.filter(({ hit }) => hit < Infinity)
				.sort((a, b) => a.hit - b.hit || a.order - b.order)
				.map(({ polygon }) => polygon);
		}
	});
}
