import type { HouseUse } from '../../data/house-body';
import type { Access, HouseStructure, Parcel, Platform, Rod, StructureNode, XY } from './contract';

/**
 * Ground one principle builder occupies. Builders place members between the centre and the
 * outer ring, so the parcel must be convex and their members ignore its courts.
 */
export type Plot = { id: string; ensemble: string; use: HouseUse; ground: number; parcel: Parcel };

/** Section radii in metres. */
const MAST_RADIUS = 0.18;
export const POST_RADIUS = 0.09;
/** A slender strut that carries cloth or a light deck. */
export const FINE_RADIUS = 0.05;
export const TIE_RADIUS = 0.02;
/** Plate depth of a light platform in metres. */
export const PLATE = 0.16;
/** Height a room leaves free below the next structure level, metres. */
export const ROOM_CLEARANCE = 0.4;

/** Mean of the ring corners: inside every convex ring. */
export function centre(ring: XY[]): XY {
	return [
		ring.reduce((sum, p) => sum + p[0], 0) / ring.length,
		ring.reduce((sum, p) => sum + p[1], 0) / ring.length
	];
}

/** Scales a convex ring about its centre; share 1 keeps it, 0 collapses it. */
export function shrink(ring: XY[], share: number): XY[] {
	const [x, y] = centre(ring);
	return ring.map(([u, v]): XY => [x + (u - x) * share, y + (v - y) * share]);
}

/** 1 for a counterclockwise ring, -1 for a clockwise one. */
export function turn(ring: XY[]) {
	const doubled = ring.reduce((sum, [x, y], i) => {
		const [u, v] = ring[(i + 1) % ring.length];
		return sum + x * v - u * y;
	}, 0);
	return doubled < 0 ? -1 : 1;
}

/**
 * Moves every edge of a convex ring inward by `by` metres and returns the new corners in the
 * same order. `by` must stay below the ring's inradius; consecutive edges must not be parallel.
 */
export function inset(ring: XY[], by: number): XY[] {
	const side = turn(ring);
	const edges = ring.map(([x, y], i) => {
		const [u, v] = ring[(i + 1) % ring.length],
			length = Math.hypot(u - x, v - y);
		const dx = (u - x) / length,
			dy = (v - y) / length;
		return { x: x - dy * by * side, y: y + dx * by * side, dx, dy };
	});
	return edges.map((b, i): XY => {
		const a = edges[(i + edges.length - 1) % edges.length];
		const t = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / (a.dx * b.dy - a.dy * b.dx);
		return [a.x + a.dx * t, a.y + a.dy * t];
	});
}

/**
 * One line of struts per ring corner through all stations, bottom to top, in world metres.
 * Every station ring has the same corner count; the nodes of the first station are founded.
 * `name(corner, level)` is the id of the node on that corner at that station.
 */
export function columns(id: string, stations: { z: number; ring: XY[] }[], radius: number) {
	const nodes: StructureNode[] = [],
		rods: Rod[] = [];
	const name = (corner: number, level: number) => id + '/' + corner + '/' + level;
	stations.forEach(({ z, ring }, level) =>
		ring.forEach(([x, y], corner) => {
			const node: StructureNode = { id: name(corner, level), position: [x, y, z] };
			nodes.push(level ? node : { ...node, founded: true });
			if (!level) return;
			const from = name(corner, level - 1);
			rods.push({ id: name(corner, level) + '/shaft', from, to: node.id, radius, action: 'strut' });
		})
	);
	return { nodes, rods, name };
}

/** Posts on the ring corners with one node per height; the lowest is founded. */
export function posts(id: string, ring: XY[], heights: number[]) {
	return columns(
		id + '/post',
		heights.map((z) => ({ z, ring })),
		POST_RADIUS
	);
}

/** One central column through `heights`, world metres ascending; the lowest node is founded. */
export function trunk(id: string, at: XY, heights: number[]) {
	const column = columns(
		id,
		heights.map((z) => ({ z, ring: [at] })),
		MAST_RADIUS
	);
	return { ...column, collar: (level: number) => column.name(0, level) };
}

/** An open deck on a shrunk parcel ring with one seat node under every corner. */
export function seatedDeck(plot: Plot, index: number, datum: number, share: number) {
	const id = plot.id + '/deck/' + index,
		outline = shrink(plot.parcel.polygon, share);
	const seats: StructureNode[] = outline.map(([x, y], corner) => ({
		id: id + '/seat/' + corner,
		position: [x, y, datum]
	}));
	const platform: Platform = {
		id,
		datum,
		thickness: PLATE,
		outline,
		bearers: seats.map((seat) => seat.id),
		programme: [plot.use]
	};
	return { platform, seats };
}

/**
 * One access run per platform in ascending order, each rising at the same plan position in
 * world metres. The first run starts on the ground at height `ground`.
 */
export function climb(
	ground: number,
	kind: Access['kind'],
	platforms: Platform[],
	[x, y]: XY
): Access[] {
	return platforms.map((platform, i) => ({
		id: platform.id + '/access',
		kind,
		...(i ? { from: platforms[i - 1].id } : {}),
		to: platform.id,
		foot: [x, y, i ? platforms[i - 1].datum : ground],
		head: [x, y, platform.datum]
	}));
}

/** Fields every builder copies from its plot. */
export function identity(plot: Plot): Pick<HouseStructure, keyof Plot> {
	const { id, ensemble, use, ground, parcel } = plot;
	return { id, ensemble, use, ground, parcel };
}
