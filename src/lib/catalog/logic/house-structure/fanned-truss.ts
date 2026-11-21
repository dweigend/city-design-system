import type { HouseStructure, Platform, SkinPatch, SpiralWell, XY } from './contract';
import { spiralAccess, spiralNewel } from './spiral';
import { hemPosts, EDGE, type Walk } from './hem';
import {
	turn,
	centre,
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

function turned(ring: XY[], angle: number): XY[] {
	const [x, y] = centre(ring),
		cos = Math.cos(angle),
		sin = Math.sin(angle);
	return ring.map(([u, v]): XY => [
		x + (u - x) * cos - (v - y) * sin,
		y + (u - x) * sin + (v - y) * cos
	]);
}

// A transverse support holds pinched faces clear of the highest occupied landing.
function spreaderRing(footRing: XY[], crownRing: XY[], share: number, well?: SpiralWell): XY[] {
	if (!well) return [];
	const waist = footRing.map(([x, y], i): XY => [
		x + (crownRing[i][0] - x) * share,
		y + (crownRing[i][1] - y) * share
	]);
	const needsSpace = waist.map(([x, y], i) => {
		const [a, b] = waist[(i + 1) % waist.length],
			dx = a - x,
			dy = b - y;
		const distance =
			(turn(footRing) * (dx * (well.axis[1] - y) - dy * (well.axis[0] - x))) / Math.hypot(dx, dy);
		return distance < well.outer + EDGE;
	});
	if (!needsSpace.some(Boolean)) return [];
	return waist.map((p, i) =>
		needsSpace[i] || needsSpace[(i + waist.length - 1) % waist.length] ? footRing[i] : p
	);
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
	const footRing = inset(ring, EDGE);
	const hem = hemPosts(plot, footRing, shape.walk),
		hub = collar(heights.length - 1);
	const spin = (TWIST * 2 * Math.PI) / ring.length;
	const crownRing = turned(shrink(ring, CROWN_SHARE), spin);
	const crown = crownRing.map((p, corner) => {
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
	const access = spiralAccess(ring, platforms, plot.ground, 'spiral', shape.walk?.groundAt);
	spiralNewel(plot.id, access, nodes, rods);
	// Where the narrowing cloth would cross the stair, a spreader holds the face clear
	// above its highest landing. Its strut stays overhead all the way to the trunk head.
	const well = access[0]?.spiral?.well;
	const highest = shape.datums.at(-1) ?? 0;
	const spreaderHeight = highest + Math.min(2.2, (shape.height - highest) / 2);
	const rim = spreaderRing(footRing, crownRing, spreaderHeight / shape.height, well).map(
		(xy, i) => {
			const id = plot.id + '/spreader/' + i;
			nodes.push({ id, position: [...xy, plot.ground + spreaderHeight] });
			rods.push({ id: id + '/rod', from: hub, to: id, radius: FINE_RADIUS, action: 'strut' });
			return { node: id };
		}
	);
	for (const [i, grip] of rim.entries())
		rods.push({
			id: grip.node + '/batten',
			from: grip.node,
			to: rim[(i + 1) % rim.length].node,
			radius: FINE_RADIUS,
			action: 'strut'
		});
	const sails = ring.map((_, face): SkinPatch => ({
		id: plot.id + '/sail/' + face,
		slot: 'shell',
		batten: rim.length ? [rim[face], rim[(face + 1) % rim.length]] : undefined,
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
		...(shape.walk?.groundAt && access.length
			? { entryDatum: shape.walk.groundAt(access[0].foot[0], access[0].foot[1]) }
			: {}),
		principle: 'fanned-truss',
		nodes: [...nodes, ...hem.nodes],
		rods: [...rods, ...hem.rods],
		platforms,
		skins: sails,
		access
	};
}
