import type { HouseStructure, Platform, Rod, StructureNode } from './contract';
import { centre, climb, identity, shrink, MAST_RADIUS, PLATE, TIE_RADIUS, type Plot } from './plot';

/** Share of the parcel ring at which the guy pegs stand and the decks end. */
const PEG_SHARE = 0.92;
const DECK_SHARE = 0.36;
/** Share of the way from the mast to the first parcel corner at which the ladder climbs. */
const LADDER_SHARE = 0.2;

/**
 * One guyed mast with a tent pulled from its head to pegs on the ground. Decks hang on mast
 * collars at `datums`, metres above ground in ascending order below `height`; a ladder chain
 * reaches each. The tent is the only enclosure and the roof. Convex parcel required.
 */
export function mastHouse(plot: Plot, shape: { height: number; datums: number[] }): HouseStructure {
	const ring = plot.parcel.polygon,
		[x, y] = centre(ring);
	const collar = (i: number) => plot.id + '/mast/' + i;
	const heights = [0, ...shape.datums, shape.height];
	const head = collar(heights.length - 1);
	const nodes: StructureNode[] = heights.map((h, i) => ({
		id: collar(i),
		position: [x, y, plot.ground + h],
		...(i ? {} : { founded: true as const })
	}));
	const rods: Rod[] = heights.slice(1).map((_, i) => ({
		id: collar(i + 1) + '/shaft',
		from: collar(i),
		to: collar(i + 1),
		radius: MAST_RADIUS,
		action: 'strut'
	}));
	const pegs = shrink(ring, PEG_SHARE).map((p, i) => {
		const id = plot.id + '/peg/' + i;
		nodes.push({ id, position: [...p, plot.ground], founded: true });
		rods.push({ id: id + '/guy', from: head, to: id, radius: TIE_RADIUS, action: 'tie' });
		return id;
	});
	const platforms: Platform[] = shape.datums.map((h, i) => ({
		id: plot.id + '/deck/' + i,
		datum: plot.ground + h,
		thickness: PLATE,
		outline: shrink(ring, DECK_SHARE),
		bearers: [collar(i + 1)],
		programme: [plot.use]
	}));
	const tent = plot.id + '/tent';
	return {
		...identity(plot),
		principle: 'mast',
		nodes,
		rods,
		platforms,
		skins: [
			{
				id: tent,
				slot: 'shell',
				use: plot.use,
				boundary: pegs.map((node) => ({ node })),
				edges: pegs.map(() => 'cable'),
				interior: [{ node: head }],
				membrane: { pressure: 0, tension: 2 }
			}
		],
		access: climb(plot.ground, 'ladder', platforms, shrink(ring, LADDER_SHARE)[0]),
		roof: { kind: 'skin', patches: [tent] }
	};
}
