import type { HouseUse } from '../../data/house-body';
import type { Access, HouseStructure, Parcel, Platform, Rod, StructureNode, XY } from './contract';

/**
 * Ground one principle builder occupies. Builders place members between the centre and the
 * outer ring, so the parcel must be convex and their members ignore its courts.
 */
export type Plot = { id: string; ensemble: string; use: HouseUse; ground: number; parcel: Parcel };

/** Section radii in metres. */
export const MAST_RADIUS = 0.18;
export const POST_RADIUS = 0.09;
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
