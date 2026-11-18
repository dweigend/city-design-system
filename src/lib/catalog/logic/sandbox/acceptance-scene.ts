import { walkwayParts, WALKWAY_WIDTH_M } from '../walkway';
import type { Primitive, Vec3 } from '../parametrik/types';
import { applyEdit, createWorld, type World } from './world';
import type { Edit } from './state';

const SEED = 7;
const COLLAGE = ['78/43', '79/43', '80/43', '78/44', '79/44'];
const CARRIER = '81/41';
const CAPSULES = [
	{ use: 'water', cells: ['86/44', '87/44', '88/44'] },
	{ use: 'energy', cells: ['92/45', '93/45', '94/45'] }
] as const;
const RAIL = ['74/37', '96/37'];
const WALKWAY = ['76/48', '77/48', '83/48', '84/46', '87/45', '89/45', '90/45'];
const FRAME: readonly [Vec3, Vec3] = [
	[-20, -134, 1],
	[108, -56, 30]
];

function interventions(): Edit[] {
	return [
		...[...COLLAGE, ...COLLAGE].map((cellId): Edit => ({ kind: 'raise', cellId, use: 'living' })),
		{ kind: 'advance' },
		{ kind: 'raise', cellId: CARRIER, use: 'living' },
		{ kind: 'advance' },
		...CAPSULES.flatMap(({ use, cells }) =>
			cells.map((cellId): Edit => ({ kind: 'raise', cellId, use }))
		),
		{ kind: 'line', transit: 'viaduct', cellIds: RAIL },
		...Array.from({ length: 9 }, (_, i): Edit => ({
			kind: 'cover',
			cellId: `${97 + (i % 3)}/${43 + Math.floor(i / 3)}`,
			cover: 'forest'
		}))
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
