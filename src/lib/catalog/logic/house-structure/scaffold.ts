import type { HouseStructure, Platform, Rod } from './contract';
import {
	climb,
	identity,
	posts,
	shrink,
	PLATE,
	POST_RADIUS,
	ROOM_CLEARANCE,
	type Plot
} from './plot';

/** Share of the parcel ring on which the scaffold stands and at which its ladders climb. */
const FRAME_SHARE = 0.95;
const LADDER_SHARE = 0.7;
/** A scaffold taller than this multiple of its shorter plan side reads as a tower. */
const TOWER_SLENDERNESS = 3;

function shortSide(ring: [number, number][]) {
	const span = (k: number) =>
		Math.max(...ring.map((p) => p[k])) - Math.min(...ring.map((p) => p[k]));
	return Math.min(span(0), span(1));
}

/**
 * Posts and ledgers in `bays` equal storeys of height `bay` metres. Only the levels listed in
 * `occupied` (1 = first ledger ring, ascending) carry a platform; those also listed in `rooms`
 * enclose a room, the rest are open decks. One screen is tensioned over the first face from the
 * lowest occupied level to the head. A platform on the head level is the roof terrace;
 * otherwise the house has no roof. Convex parcel required.
 */
export function scaffoldHouse(
	plot: Plot,
	shape: { bay: number; bays: number; occupied: number[]; rooms: number[] }
): HouseStructure {
	const ring = shrink(plot.parcel.polygon, FRAME_SHARE);
	const heights = Array.from({ length: shape.bays + 1 }, (_, k) => plot.ground + k * shape.bay);
	const frame = posts(plot.id, ring, heights);
	const ledgers: Rod[] = heights.slice(1).flatMap((_, k) =>
		ring.map((_, corner) => ({
			id: frame.name(corner, k + 1) + '/ledger',
			from: frame.name(corner, k + 1),
			to: frame.name((corner + 1) % ring.length, k + 1),
			radius: POST_RADIUS,
			action: 'strut' as const
		}))
	);
	const platforms: Platform[] = shape.occupied.map((level) => ({
		id: plot.id + '/level/' + level,
		datum: heights[level],
		thickness: PLATE,
		outline: ring,
		bearers: ring.map((_, corner) => frame.name(corner, level)),
		programme: [plot.use],
		...(shape.rooms.includes(level) ? { room: { height: shape.bay - ROOM_CLEARANCE } } : {})
	}));
	const top = shape.bays,
		terrace = platforms.find((p) => p.datum === heights[top]);
	return {
		...identity(plot),
		principle: shape.bays * shape.bay > TOWER_SLENDERNESS * shortSide(ring) ? 'tower' : 'scaffold',
		nodes: frame.nodes,
		rods: [...frame.rods, ...ledgers],
		platforms,
		skins: [
			{
				id: plot.id + '/screen',
				slot: 'screen',
				use: plot.use,
				boundary: [
					{ node: frame.name(0, shape.occupied[0]) },
					{ node: frame.name(1, shape.occupied[0]) },
					{ node: frame.name(1, top) },
					{ node: frame.name(0, top) }
				]
			}
		],
		access: climb(plot.ground, 'ladder', platforms, shrink(plot.parcel.polygon, LADDER_SHARE)[0]),
		...(terrace ? { roof: { kind: 'terrace' as const, platform: terrace.id } } : {})
	};
}
