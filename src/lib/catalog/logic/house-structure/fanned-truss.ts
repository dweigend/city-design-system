import type { HouseStructure, Platform, Rod, SkinPatch, StructureNode } from './contract';
import {
	centre,
	climb,
	identity,
	shrink,
	MAST_RADIUS,
	PLATE,
	POST_RADIUS,
	TIE_RADIUS,
	type Plot
} from './plot';

/** Share of the parcel ring the rod tips reach and the deck covers. */
const TIP_SHARE = 0.94;
const DECK_SHARE = 0.5;
/** Share of the trunk height at which every sail is tied down. */
const SAIL_FOOT = 0.55;
/** Share of the way from the trunk to the first parcel corner at which the stair winds. */
const STAIR_SHARE = 0.25;

/**
 * A trunk whose head fans rods outward and upward to the parcel corners. Each pair of
 * neighbouring tips tensions one sail down to the trunk; a rim cable joins the tips. One open
 * deck sits on the trunk head at `datum`, the tips rise to `height`, both in metres above
 * ground. The house has no roof. Convex parcel required.
 */
export function fannedTrussHouse(
	plot: Plot,
	shape: { datum: number; height: number }
): HouseStructure {
	const ring = plot.parcel.polygon,
		[x, y] = centre(ring);
	const foot = plot.id + '/trunk/foot',
		hub = plot.id + '/trunk/hub',
		trunk = plot.id + '/trunk';
	const tip = (corner: number) => plot.id + '/tip/' + (corner % ring.length);
	const nodes: StructureNode[] = [
		{ id: foot, position: [x, y, plot.ground], founded: true },
		{ id: hub, position: [x, y, plot.ground + shape.datum] }
	];
	const rods: Rod[] = [{ id: trunk, from: foot, to: hub, radius: MAST_RADIUS, action: 'strut' }];
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
			boundary: [{ node: tip(corner) }, { node: tip(corner + 1) }, { rod: trunk, at: SAIL_FOOT }],
			edges: ['cable', 'seam', 'seam'],
			membrane: { pressure: 0, tension: 3 }
		});
	});
	const deck: Platform = {
		id: plot.id + '/deck',
		datum: plot.ground + shape.datum,
		thickness: PLATE,
		outline: shrink(ring, DECK_SHARE),
		bearers: [hub],
		programme: [plot.use]
	};
	return {
		...identity(plot),
		principle: 'fanned-truss',
		nodes,
		rods,
		platforms: [deck],
		skins: sails,
		access: climb(plot.ground, 'spiral', [deck], shrink(ring, STAIR_SHARE)[0])
	};
}
