import { walkwayParts, WALKWAY_WIDTH_M } from '../walkway';
import type { Primitive, Vec3 } from '../parametrik/types';
import { applyEdit, createWorld, type World } from './world';
import type { Edit } from './state';

const SEED = 7;
const COLLAGE = ['79/44', '80/44', '81/44', '80/45', '81/45'];
const CARRIER = '82/41';
const CAPSULES = [
	{ use: 'water', cells: ['83/44', '84/44', '85/44'] },
	{ use: 'energy', cells: ['92/45', '93/45', '94/45'] }
] as const;
const RAIL = ['74/35', '96/35'];
const WALKWAY = ['75/48', '76/48', '83/48', '84/46', '88/45', '91/44', '92/44'];
const FOREST = [
	'101/42',
	'102/42',
	'103/42',
	'101/43',
	'102/43',
	'103/43',
	'104/43',
	'102/44',
	'103/44'
];
const FRAME: readonly [Vec3, Vec3] = [
	[-20, -134, 1],
	[145, -56, 30]
];

function interventions(): Edit[] {
	return [
		...[...COLLAGE, ...COLLAGE].map((cellId): Edit => ({
			kind: 'raise',
			cellId,
			use: 'living',
			style: 'collage'
		})),
		{ kind: 'raise', cellId: CARRIER, use: 'living', style: 'megastructure' },
		...CAPSULES.flatMap(({ use, cells }) =>
			cells.map((cellId): Edit => ({ kind: 'raise', cellId, use, style: 'totem' }))
		),
		{ kind: 'line', transit: 'viaduct', cellIds: RAIL },
		...FOREST.map((cellId): Edit => ({ kind: 'cover', cellId, cover: 'forest' }))
	];
}

function elevatedWalkway({ grid }: World): Primitive[] {
	const ground = WALKWAY.map((id) => {
		const cell = grid.cellsById.get(id);
		if (!cell) throw new Error(`Missing acceptance cell ${id}`);
		return cell.center;
	});
	const groundZ = Math.min(...ground.map((point) => point[2]));
	const deckZ = Math.max(...ground.map((point) => point[2])) + 6;
	// Flat terminal spans are the landings. The next spans step up to the level deck.
	const route = ground.map(([x, y], i): Vec3 => [
		x,
		y,
		i < 2 || i >= ground.length - 2 ? groundZ + 0.35 : deckZ
	]);
	return walkwayParts(route, { id: 'acceptance-walkway', width: WALKWAY_WIDTH_M, groundZ }).map(
		(part) =>
			part.kind === 'cylinder' ? { ...part, role: 'traeger', bearings: [part.position] } : part
	);
}

/** Replays the seed-7 interventions and returns the fixed drafting study in world meters. */
export function acceptanceScene() {
	const start = createWorld(SEED);
	const world = interventions().reduce(applyEdit, start);
	return {
		world,
		earliestFullYear: start.state.year,
		additions: elevatedWalkway(world),
		frame: FRAME
	};
}
