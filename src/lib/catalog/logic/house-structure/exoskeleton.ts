import type { Vec3 } from '../parametrik/types';
import type { HouseStructure, Platform, Rod, SkinPatch, StructureNode } from './contract';
import { spiralAccess, spiralNewel } from './spiral';
import { hemPosts, EDGE, type Walk } from './hem';
import {
	identity,
	inset,
	shrink,
	turn,
	PLATE,
	FINE_RADIUS,
	ROOM_CLEARANCE,
	TIE_RADIUS,
	type Plot
} from './plot';

/** Share of the parcel ring the head ring covers, and of the lantern's width a room fills. */
const HEAD_SHARE = 0.5;
const ROOM_FILL = 0.8;
/** Gauge pressure of the cushions in kPa and their tension in kN/m. */
const CUSHION = { pressure: 0.25, tension: 3 };

/**
 * A lantern of cushions on an outer frame. Slender posts lean from the parcel corners to a
 * smaller head ring at `height`; one inflated cloth per parcel face fills the frame from the
 * hem to the head, so the house is one use-coloured pillow body. Platforms hang inside on ties
 * from the head ring at `datums`, metres above ground in ascending order below `height`, and
 * narrow with the lantern; every second one, starting with the lowest, encloses a room. Every
 * face that `walk` passes lifts its hem as the way in. Convex parcel required.
 */
export function exoskeletonHouse(
	plot: Plot,
	shape: { height: number; datums: number[]; walk?: Walk }
): HouseStructure {
	const ring = plot.parcel.polygon,
		count = ring.length;
	const top = plot.ground + shape.height;
	const heads = shrink(ring, HEAD_SHARE).map((p): Vec3 => [...p, top]);
	const hem = hemPosts(plot, inset(ring, EDGE), shape.walk, heads);
	const head = (corner: number) => plot.id + '/head/' + (corner % count);
	const nodes: StructureNode[] = [...hem.nodes],
		rods: Rod[] = [...hem.rods];
	heads.forEach((position, corner) => {
		const strut = { radius: FINE_RADIUS, action: 'strut' as const };
		nodes.push({ id: head(corner), position });
		rods.push({ id: head(corner) + '/post', from: hem.top(corner), to: head(corner), ...strut });
		rods.push({ id: head(corner) + '/ring', from: head(corner), to: head(corner + 1), ...strut });
	});
	const levels = [...shape.datums, shape.height];
	const platforms: Platform[] = shape.datums.map((h, k) => {
		const id = plot.id + '/room/' + k,
			datum = plot.ground + h;
		const share = ROOM_FILL * (1 - ((1 - HEAD_SHARE) * levels[k + 1]) / shape.height);
		const outline = shrink(ring, share);
		const bearers = outline.map(([x, y], corner) => {
			const seat = id + '/seat/' + corner;
			nodes.push({ id: seat, position: [x, y, datum] });
			rods.push({
				id: seat + '/hanger',
				from: head(corner),
				to: seat,
				radius: TIE_RADIUS,
				action: 'tie'
			});
			return seat;
		});
		const room = { height: levels[k + 1] - h - ROOM_CLEARANCE };
		return {
			id,
			datum,
			thickness: PLATE,
			outline,
			bearers,
			programme: [plot.use],
			...(k % 2 ? {} : { room })
		};
	});
	const access = spiralAccess(ring, platforms, plot.ground, 'stair', shape.walk?.groundAt);
	spiralNewel(plot.id, access, nodes, rods);
	const cushions = ring.map((_, face): SkinPatch => {
		const loop = [...hem.grips(face), { node: head(face + 1) }, { node: head(face) }];
		return {
			id: plot.id + '/cushion/' + face,
			slot: 'shell',
			use: plot.use,
			// Pressure acts along the right-hand normal: the loop runs counterclockwise from outside.
			boundary: turn(ring) > 0 ? loop : [loop[1], loop[0], loop[3], loop[2]],
			edges: ['cable', 'seam', 'seam', 'seam'],
			membrane: CUSHION
		};
	});
	return {
		...identity(plot),
		...(shape.walk?.groundAt && access.length
			? { entryDatum: shape.walk.groundAt(access[0].foot[0], access[0].foot[1]) }
			: {}),
		principle: 'exoskeleton',
		nodes,
		rods,
		platforms,
		skins: cushions,
		access
	};
}
