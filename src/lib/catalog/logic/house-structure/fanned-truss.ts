import type { HouseStructure, Platform, SkinPatch } from './contract';
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

/** Share of the parcel ring the rod tips reach and the decks cover. */
const TIP_SHARE = 0.96;
const DECK_SHARE = 0.55;
/** Rise of the rod tips above the hub they fan from, metres. */
const FAN_RISE = 2.6;
/** Share of the way from the trunk to the first parcel corner at which the stair winds. */
const STAIR_SHARE = 0.25;

/**
 * A trunk that fans rods outward at every level. Under each deck at `datums`, metres above
 * ground in ascending order, struts fan from the collar below to the deck corners. At the hub
 * below the trunk head rods fan outward and upward to tips at `height`; each pair of
 * neighbouring tips tensions one sail back to the hub, and a rim cable joins the tips. The
 * sails are an open canopy, not a roof. `height` must exceed the highest deck by more than the
 * fan rise. Convex parcel required.
 */
export function fannedTrussHouse(
	plot: Plot,
	shape: { datums: number[]; height: number }
): HouseStructure {
	const ring = plot.parcel.polygon,
		[x, y] = centre(ring);
	const heights = [0, ...shape.datums, shape.height - FAN_RISE].map((h) => plot.ground + h);
	const { nodes, rods, collar } = trunk(plot.id + '/trunk', [x, y], heights);
	const hub = collar(heights.length - 1);
	const tip = (corner: number) => plot.id + '/tip/' + (corner % ring.length);
	const sails: SkinPatch[] = [];
	shrink(ring, TIP_SHARE).forEach((p, corner) => {
		nodes.push({ id: tip(corner), position: [...p, plot.ground + shape.height] });
		rods.push(
			{
				id: tip(corner) + '/rod',
				from: hub,
				to: tip(corner),
				radius: POST_RADIUS,
				action: 'strut'
			},
			{
				id: tip(corner) + '/rim',
				from: tip(corner),
				to: tip(corner + 1),
				radius: TIE_RADIUS,
				action: 'tie'
			}
		);
		sails.push({
			id: plot.id + '/sail/' + corner,
			slot: 'screen',
			use: plot.use,
			boundary: [{ node: tip(corner) }, { node: tip(corner + 1) }, { node: hub }],
			edges: ['cable', 'seam', 'seam'],
			membrane: { pressure: 0, tension: 3 }
		});
	});
	const platforms: Platform[] = shape.datums.map((h, i) => {
		const { platform, seats } = seatedDeck(plot, i, plot.ground + h, DECK_SHARE);
		for (const { id } of seats)
			rods.push({ id: id + '/fan', from: collar(i), to: id, radius: POST_RADIUS, action: 'strut' });
		nodes.push(...seats);
		return platform;
	});
	return {
		...identity(plot),
		principle: 'fanned-truss',
		nodes,
		rods,
		platforms,
		skins: sails,
		access: climb(plot.ground, 'spiral', platforms, shrink(ring, STAIR_SHARE)[0])
	};
}
