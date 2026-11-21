import type { HouseStructure, Platform, SkinPatch, SpiralWell, XY } from './contract';
import { spiralAccess, spiralNewel } from './spiral';
import { hemPosts, EDGE, type Walk } from './hem';
import {
	centre,
	identity,
	inset,
	seatedDeck,
	shrink,
	trunk,
	turn,
	FINE_RADIUS,
	TIE_RADIUS,
	type Plot
} from './plot';

/** Share of the parcel ring on which the calyx stands, and that its decks cover. */
const FOOT_SHARE = 0.6;
const DECK_SHARE = 0.45;
/** Height of the mast head above the brim, metres. */
const HEAD_RISE = 0.8;

/** Widens the hem only when the calyx would cut through the stair on a compact parcel. */
function hemRing(ring: XY[], well?: SpiralWell): XY[] {
	if (!well) return shrink(ring, FOOT_SHARE);
	const c = centre(ring);
	const orientation = turn(ring);
	const share = ring.reduce((fill, [x, y], i) => {
		const [u, v] = ring[(i + 1) % ring.length];
		const dx = u - x,
			dy = v - y;
		const distance = ([px, py]: XY) =>
			(orientation * (dx * (py - y) - dy * (px - x))) / Math.hypot(dx, dy);
		return Math.max(fill, 1 - (distance(well.axis) - well.outer - EDGE) / distance(c));
	}, FOOT_SHARE);
	return shrink(ring, Math.min(1, share));
}

/**
 * One mast inside a calyx of cloth. Hem posts stand on a small ring around the mast; ties from
 * the mast head hold a brim near the parcel edge, 0.8 m below the head. One cloth per parcel
 * face flares from the hem to the brim, so the house is one open use-coloured funnel. Decks at
 * `datums`, metres above ground in ascending order, stand inside it on props from the collar
 * below. `height` is the mast head above ground and must clear the highest deck and 3.8 m.
 * Every face that `walk` passes lifts its hem as the way in. Convex parcel required.
 */
export function mastHouse(
	plot: Plot,
	shape: { height: number; datums: number[]; walk?: Walk }
): HouseStructure {
	const ring = plot.parcel.polygon,
		brim = plot.ground + shape.height - HEAD_RISE;
	const heights = [0, ...shape.datums, shape.height].map((h) => plot.ground + h);
	const { nodes, rods, collar } = trunk(plot.id + '/mast', centre(ring), heights);
	const head = collar(heights.length - 1);
	const tips = inset(ring, EDGE).map((p, corner) => {
		const id = plot.id + '/brim/' + corner;
		nodes.push({ id, position: [...p, brim] });
		rods.push({ id: id + '/stay', from: head, to: id, radius: TIE_RADIUS, action: 'tie' });
		return id;
	});
	const platforms: Platform[] = shape.datums.map((h, i) => {
		const { platform, seats } = seatedDeck(plot, i, plot.ground + h, DECK_SHARE);
		// Props rise from the collar below, so each deck hides its own bearers from above.
		for (const { id } of seats)
			rods.push({
				id: id + '/prop',
				from: collar(i),
				to: id,
				radius: FINE_RADIUS,
				action: 'strut'
			});
		nodes.push(...seats);
		return platform;
	});
	const access = spiralAccess(ring, platforms, plot.ground, 'spiral', shape.walk?.groundAt);
	const foot = access[0]?.foot;
	const walk =
		shape.walk && foot
			? { ...shape.walk, from: [foot[0], foot[1]] as [number, number] }
			: shape.walk;
	const hem = hemPosts(plot, hemRing(ring, access[0]?.spiral?.well), walk);
	spiralNewel(plot.id, access, nodes, rods);
	const calyx = ring.map((_, face): SkinPatch => {
		const next = (face + 1) % ring.length;
		return {
			id: plot.id + '/calyx/' + face,
			slot: 'shell',
			use: plot.use,
			boundary: [...hem.grips(face), { node: tips[next] }, { node: tips[face] }],
			edges: ['cable', 'seam', 'cable', 'seam'],
			membrane: { pressure: 0, tension: 3 }
		};
	});
	return {
		...identity(plot),
		...(foot && shape.walk?.groundAt ? { entryDatum: foot[2] } : {}),
		principle: 'mast',
		nodes: [...nodes, ...hem.nodes],
		rods: [...rods, ...hem.rods],
		platforms,
		skins: calyx,
		access
	};
}
