import type { HouseStructure, SkinPatch, XY } from './contract';
import { convexHull } from '../parzelle';
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
	TIE_RADIUS,
	type Plot
} from './plot';

/** Clear height kept between the lookout and the cloth above its corners, metres. */
const HEADROOM = 2.2;
/** Share of the cloth's plan reach at lookout height that the lookout may fill. */
const NEST_FILL = 0.85;
/** Smallest and largest share of the parcel ring a lookout covers. */
const NEST_MIN = 0.2;
const NEST_MAX = 0.5;
/** Share of the way from the mast to the first parcel corner at which the ladder climbs. */
const LADDER_SHARE = 0.12;
/** Ratio of the landing lip to the ladder opening about the shaft axis. */
const LANDING_SHARE = 1.25;

/**
 * One free-standing mast with a single high lookout inside a cone of cloth. One gore per
 * parcel face runs from the hem posts to the mast tip, so the whole house is one use-coloured
 * spire. The space below the lookout stays free. `height` is the mast tip and `lookout` the
 * platform, both metres above ground; the lookout shrinks to fit under the cloth. Every face
 * that `walk` passes lifts its hem as the way in. Convex parcel required.
 */
export function tentMastHouse(
	plot: Plot,
	shape: { height: number; lookout: number; walk?: Walk; well?: { axis: XY; opening: XY[] } }
): HouseStructure {
	const ring = plot.parcel.polygon,
		datum = plot.ground + shape.lookout;
	const mast = trunk(plot.id + '/mast', centre(ring), [
		plot.ground,
		datum,
		plot.ground + shape.height
	]);
	const hem = hemPosts(plot, inset(ring, EDGE), shape.walk),
		tip = mast.collar(2);
	const reach = 1 - (shape.lookout + HEADROOM) / shape.height;
	const share = Math.min(NEST_MAX, Math.max(NEST_MIN, NEST_FILL * reach));
	const { platform, seats } = seatedDeck(plot, 0, datum, share);
	const axis = shape.well?.axis ?? shrink(ring, LADDER_SHARE)[0];
	if (shape.well) {
		const lip = shape.well.opening.map(([x, y]): XY => [
			axis[0] + LANDING_SHARE * (x - axis[0]),
			axis[1] + LANDING_SHARE * (y - axis[1])
		]);
		platform.outline = convexHull([...platform.outline, ...lip]).map(([x, y]) => [x, y]);
		platform.holes = [shape.well.opening];
	}
	const rods = [...mast.rods, ...hem.rods];
	for (const { id } of seats)
		rods.push(
			{ id: id + '/spoke', from: mast.collar(1), to: id, radius: FINE_RADIUS, action: 'strut' },
			{ id: id + '/hanger', from: tip, to: id, radius: TIE_RADIUS, action: 'tie' }
		);
	const gores = ring.map((_, face): SkinPatch => ({
		id: plot.id + '/gore/' + face,
		slot: 'shell',
		use: plot.use,
		boundary: [...hem.grips(face), { node: tip }],
		edges: ['cable', 'seam', 'seam'],
		membrane: { pressure: 0, tension: 2 }
	}));
	return {
		...identity(plot),
		principle: 'mast',
		nodes: [...mast.nodes, ...hem.nodes, ...seats],
		rods,
		platforms: [platform],
		skins: gores,
		access: climb(plot.ground, 'ladder', [platform], axis),
		roof: { kind: 'skin', patches: gores.map((gore) => gore.id) }
	};
}
