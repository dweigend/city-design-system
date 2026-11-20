import type { Vec3 } from '../parametrik/types';
import type { Grip, Rod, StructureNode, XY } from './contract';
import { FINE_RADIUS, type Plot } from './plot';

/** The ground walk into a house in plan, world metres: from its stair foot out to the parcel face. */
export type Walk = { from: XY; to: XY; width: number };

/** Distance from the parcel edge at which slender posts and cloth edges stand, metres. */
export const EDGE = 0.15;
/** Height of a cloth hem and of a door lintel above the parcel ground, metres. */
const HEM = 0.4;
const LINTEL = 3;
/** Clearance between the edge of the walk and a hem that stays down, metres. */
const CLEARANCE = 0.3;

function toSegment([x, y]: XY, [a, b]: XY, [u, v]: XY) {
	const dx = u - a,
		dy = v - b;
	const t = Math.max(0, Math.min(1, ((x - a) * dx + (y - b) * dy) / (dx * dx + dy * dy || 1)));
	return Math.hypot(x - a - t * dx, y - b - t * dy);
}

function side(a: XY, b: XY, p: XY) {
	return Math.sign((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
}

/** Plan distance between two segments in metres; zero where they cross. */
function apart(a: XY, b: XY, c: XY, d: XY) {
	if (side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b)) return 0;
	return Math.min(toSegment(a, c, d), toSegment(b, c, d), toSegment(c, a, b), toSegment(d, a, b));
}

/** True for every ring face the walk passes closer than its half width plus the clearance. */
function doors(ring: XY[], walk?: Walk) {
	if (!walk) return ring.map(() => false);
	const reach = walk.width / 2 + CLEARANCE;
	return ring.map((a, i) => apart(a, ring[(i + 1) % ring.length], walk.from, walk.to) < reach);
}

/** The point `rise` metres above a post foot, on the line to its head or straight up. */
function along([x, y, ground]: Vec3, head: Vec3 | undefined, rise: number): Vec3 {
	if (!head) return [x, y, ground + rise];
	const t = rise / (head[2] - ground);
	return [x + (head[0] - x) * t, y + (head[1] - y) * t, ground + rise];
}

/**
 * The lower edge of a cloth house: one slender founded post per corner of `ring`, a convex ring
 * inside the parcel in world metres, with a hem node 0.4 m above ground. Cloth so never rests on the ground. Both
 * corners of every face that `walk` passes rise on to a lintel node at 3 m, which lifts that
 * face's hem clear of the way in. A post leans towards `heads[corner]`, a point in world metres
 * above the lintel, or stands upright without one.
 *
 * `grips(face)` are the two lower grips of the cloth on the face from corner `face` to the
 * next; `top(corner)` is the highest node of that corner's post.
 */
export function hemPosts(plot: Plot, ring: XY[], walk?: Walk, heads?: Vec3[]) {
	const open = doors(ring, walk),
		count = ring.length;
	const name = (corner: number, level: number) =>
		plot.id + '/hem/' + (corner % count) + '/' + level;
	const level = (corner: number) =>
		open[corner % count] || open[(corner + count - 1) % count] ? 2 : 1;
	const nodes: StructureNode[] = [],
		rods: Rod[] = [];
	ring.forEach((foot, corner) => {
		const base: Vec3 = [...foot, plot.ground];
		nodes.push({ id: name(corner, 0), position: base, founded: true });
		[HEM, LINTEL].slice(0, level(corner)).forEach((rise, i) => {
			const id = name(corner, i + 1);
			nodes.push({ id, position: along(base, heads?.[corner], rise) });
			rods.push({
				id: id + '/post',
				from: name(corner, i),
				to: id,
				radius: FINE_RADIUS,
				action: 'strut'
			});
		});
	});
	const grips = (face: number): [Grip, Grip] => {
		const at = open[face] ? 2 : 1;
		return [{ node: name(face, at) }, { node: name(face + 1, at) }];
	};
	return { nodes, rods, grips, top: (corner: number) => name(corner, level(corner)) };
}
