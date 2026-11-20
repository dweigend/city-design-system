import type { HouseStructure, SkinPatch } from './contract';
import {
	centre,
	climb,
	identity,
	seatedDeck,
	shrink,
	trunk,
	POST_RADIUS,
	TIE_RADIUS,
	type Plot
} from './plot';

/** Share of the parcel ring on which the ground anchors stand. */
const ANCHOR_SHARE = 0.96;
/** Clear height kept between the lookout and the cloth above its corners, metres. */
const HEADROOM = 2.2;
/** Share of the cloth's plan reach at lookout height that the lookout may fill. */
const NEST_FILL = 0.85;
/** Smallest and largest share of the parcel ring a lookout covers. */
const NEST_MIN = 0.2;
const NEST_MAX = 0.5;
/** Share of the way from the mast to the first parcel corner at which the ladder climbs. */
const LADDER_SHARE = 0.12;

/**
 * One free-standing mast with a single high lookout and cloth pulled from the mast tip to
 * anchors on the ground. The space below the lookout stays free. `height` is the mast tip and
 * `lookout` the platform, both metres above ground; the lookout shrinks to fit under the cloth.
 * The cloth leaves the bay after anchor `open` without a gore, as the way in. Convex parcel
 * required.
 */
export function tentMastHouse(
	plot: Plot,
	shape: { height: number; lookout: number; open: number }
): HouseStructure {
	const ring = plot.parcel.polygon,
		datum = plot.ground + shape.lookout;
	const mast = trunk(plot.id + '/mast', centre(ring), [
		plot.ground,
		datum,
		plot.ground + shape.height
	]);
	const { nodes, rods } = mast,
		tip = mast.collar(2);
	const anchors = shrink(ring, ANCHOR_SHARE).map(([x, y], corner) => {
		const id = plot.id + '/anchor/' + corner;
		nodes.push({ id, position: [x, y, plot.ground], founded: true });
		return id;
	});
	const reach = ANCHOR_SHARE * (1 - (shape.lookout + HEADROOM) / shape.height);
	const share = Math.min(NEST_MAX, Math.max(NEST_MIN, NEST_FILL * reach));
	const { platform, seats } = seatedDeck(plot, 0, datum, share);
	for (const { id } of seats)
		rods.push(
			{ id: id + '/spoke', from: mast.collar(1), to: id, radius: POST_RADIUS, action: 'strut' },
			{ id: id + '/hanger', from: tip, to: id, radius: TIE_RADIUS, action: 'tie' }
		);
	nodes.push(...seats);
	const gores = anchors.flatMap((node, corner): SkinPatch[] => {
		if (corner === shape.open % anchors.length) return [];
		return [
			{
				id: plot.id + '/gore/' + corner,
				slot: 'shell',
				use: plot.use,
				boundary: [{ node }, { node: anchors[(corner + 1) % anchors.length] }, { node: tip }],
				edges: ['cable', 'seam', 'seam'],
				membrane: { pressure: 0, tension: 2 }
			}
		];
	});
	return {
		...identity(plot),
		principle: 'mast',
		nodes,
		rods,
		platforms: [platform],
		skins: gores,
		access: climb(plot.ground, 'ladder', [platform], shrink(ring, LADDER_SHARE)[0]),
		roof: { kind: 'skin', patches: gores.map((gore) => gore.id) }
	};
}
