import type { HouseStructure, Platform, SkinPatch, XY } from './contract';
import { hemPosts, EDGE, type Walk } from './hem';
import {
	centre,
	climb,
	identity,
	inset,
	seatedDeck,
	shrink,
	trunk,
	FINE_RADIUS,
	type Plot
} from './plot';

/** Share of the parcel ring the crown covers, and its turn as a share of one face step. */
const CROWN_SHARE = 0.28;
const TWIST = 0.5;
/** Share of the parcel ring a deck covers at ground level, and its loss up to the crown. */
const DECK_SHARE = 0.5;
const DECK_TAPER = 0.75;
/** Share of the way from the trunk to the first parcel corner at which the stair winds. */
const STAIR_SHARE = 0.25;

function turned(ring: XY[], angle: number): XY[] {
	const [x, y] = centre(ring),
		cos = Math.cos(angle),
		sin = Math.sin(angle);
	return ring.map(([u, v]): XY => [
		x + (u - x) * cos - (v - y) * sin,
		y + (u - x) * sin + (v - y) * cos
	]);
}

/**
 * A trunk inside a twisted tower of cloth. Rods fan from the trunk head to a small crown ring
 * at `height`, turned by half a face step against the parcel; one cloth per parcel face is
 * tensioned from the hem posts to its crown edge and so winds as a saddle. Under each deck at
 * `datums`, metres above ground in ascending order, struts fan from the collar below; decks
 * narrow towards the crown. `height` must exceed the highest deck. Every face that `walk`
 * passes lifts its hem as the way in. Convex parcel required.
 */
export function fannedTrussHouse(
	plot: Plot,
	shape: { datums: number[]; height: number; walk?: Walk }
): HouseStructure {
	const ring = plot.parcel.polygon;
	const heights = [0, ...shape.datums, shape.height].map((h) => plot.ground + h);
	const { nodes, rods, collar } = trunk(plot.id + '/trunk', centre(ring), heights);
	const hem = hemPosts(plot, inset(ring, EDGE), shape.walk),
		hub = collar(heights.length - 1);
	const spin = (TWIST * 2 * Math.PI) / ring.length;
	const crown = turned(shrink(ring, CROWN_SHARE), spin).map((p, corner) => {
		const id = plot.id + '/crown/' + corner;
		nodes.push({ id, position: [...p, plot.ground + shape.height] });
		rods.push({ id: id + '/rod', from: hub, to: id, radius: FINE_RADIUS, action: 'strut' });
		return id;
	});
	const platforms: Platform[] = shape.datums.map((h, i) => {
		const share = DECK_SHARE * (1 - (DECK_TAPER * h) / shape.height);
		const { platform, seats } = seatedDeck(plot, i, plot.ground + h, share);
		for (const { id } of seats)
			rods.push({ id: id + '/fan', from: collar(i), to: id, radius: FINE_RADIUS, action: 'strut' });
		nodes.push(...seats);
		return platform;
	});
	const sails = ring.map((_, face): SkinPatch => ({
		id: plot.id + '/sail/' + face,
		slot: 'shell',
		use: plot.use,
		boundary: [
			...hem.grips(face),
			{ node: crown[(face + 1) % ring.length] },
			{ node: crown[face] }
		],
		edges: ['cable', 'seam', 'cable', 'seam'],
		membrane: { pressure: 0, tension: 3 }
	}));
	return {
		...identity(plot),
		principle: 'fanned-truss',
		nodes: [...nodes, ...hem.nodes],
		rods: [...rods, ...hem.rods],
		platforms,
		skins: sails,
		access: climb(plot.ground, 'spiral', platforms, shrink(ring, STAIR_SHARE)[0])
	};
}
