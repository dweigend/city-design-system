import type { HouseStructure, Platform, Rod, SkinPatch, StructureNode } from './contract';
import {
	climb,
	identity,
	posts,
	shrink,
	PLATE,
	POST_RADIUS,
	ROOM_CLEARANCE,
	TIE_RADIUS,
	type Plot
} from './plot';

/** Share of the parcel ring on which the outer frame stands and inside which rooms hang. */
const FRAME_SHARE = 0.96;
const ROOM_SHARE = 0.62;
/** Share of the ring at which the stair climbs, between the rooms and the frame. */
const STAIR_SHARE = 0.8;

/**
 * An outer frame of posts, a head ring and tie braces. Rooms hang clear inside it on brackets
 * at `datums`, metres above ground in ascending order below `height`. Screens are tensioned
 * between the posts from the first datum to the head, and a cloth closes the head ring.
 * Convex parcel required.
 */
export function exoskeletonHouse(
	plot: Plot,
	shape: { height: number; datums: number[] }
): HouseStructure {
	const ring = shrink(plot.parcel.polygon, FRAME_SHARE),
		inner = shrink(plot.parcel.polygon, ROOM_SHARE);
	const heights = [0, ...shape.datums, shape.height].map((h) => plot.ground + h);
	const top = heights.length - 1;
	const frame = posts(plot.id, ring, heights);
	const nodes: StructureNode[] = [...frame.nodes],
		rods: Rod[] = [...frame.rods];
	const next = (corner: number) => (corner + 1) % ring.length;
	ring.forEach((_, corner) => {
		const beam = { radius: POST_RADIUS, action: 'strut' as const };
		const brace = { radius: TIE_RADIUS, action: 'tie' as const };
		const head = frame.name(corner, top);
		rods.push({ id: head + '/ring', from: head, to: frame.name(next(corner), top), ...beam });
		rods.push({
			id: frame.name(corner, 0) + '/brace',
			from: frame.name(corner, 0),
			to: frame.name(next(corner), 1),
			...brace
		});
	});
	const platforms: Platform[] = shape.datums.map((_, k) => {
		const id = plot.id + '/room/' + k,
			datum = heights[k + 1];
		const bearers = inner.map(([x, y], corner) => {
			const seat = id + '/seat/' + corner;
			nodes.push({ id: seat, position: [x, y, datum] });
			rods.push({
				id: seat + '/bracket',
				from: frame.name(corner, k + 1),
				to: seat,
				radius: POST_RADIUS,
				action: 'strut'
			});
			return seat;
		});
		return {
			id,
			datum,
			thickness: PLATE,
			outline: inner,
			bearers,
			programme: [plot.use],
			room: { height: heights[k + 2] - datum - ROOM_CLEARANCE }
		};
	});
	const screens: SkinPatch[] = ring.map((_, corner) => ({
		id: plot.id + '/screen/' + corner,
		slot: 'screen',
		use: plot.use,
		boundary: [
			{ node: frame.name(corner, 1) },
			{ node: frame.name(next(corner), 1) },
			{ node: frame.name(next(corner), top) },
			{ node: frame.name(corner, top) }
		]
	}));
	const cover: SkinPatch = {
		id: plot.id + '/cover',
		slot: 'shell',
		use: plot.use,
		boundary: ring.map((_, corner) => ({ node: frame.name(corner, top) }))
	};
	return {
		...identity(plot),
		principle: 'exoskeleton',
		nodes,
		rods,
		platforms,
		skins: [...screens, cover],
		access: climb(plot.ground, 'stair', platforms, shrink(plot.parcel.polygon, STAIR_SHARE)[0]),
		roof: { kind: 'skin', patches: [cover.id] }
	};
}
