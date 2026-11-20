import { openCity } from './city-opening';
import { TWO_SUNS_CELLS, twoSuns } from './two-suns';
import { advanceFrames } from './frame-construction';
import { planTownForms } from '../town-forms';
import { walkwayParts } from '../walkway';
import type { Primitive, Vec3 } from '../parametrik/types';
import { applyEdit, createWorld, type World } from './world';
import type { Edit } from './state';

const SEED = 7;
type Use = Extract<Edit, { kind: 'raise' }>['use'];
type Cover = Extract<Edit, { kind: 'cover' }>['cover'];
/** Inclusive cell rectangle `[column0, row0, column1, row1]`. */
type Rect = readonly [number, number, number, number];

const cellsIn = ([i0, j0, i1, j1]: Rect) => {
	const ids: string[] = [];
	for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) ids.push(`${i}/${j}`);
	return ids;
};
const composedStory = (cellId: string, use: Use): Edit => ({
	kind: 'raise',
	cellId,
	use,
	style: 'composed'
});
const story = (use: Use, rect: Rect): Edit[] => cellsIn(rect).map((id) => composedStory(id, use));
const cover = (kind: Cover, rect: Rect): Edit[] =>
	cellsIn(rect).map((cellId) => ({ kind: 'cover', cellId, cover: kind }));

/** Mixed-use tower in the courtyard: every story a use, the footprint steps back. */
const TOWER: readonly (readonly [Use, Rect])[] = [
	['living', [79, 44, 81, 45]],
	['material', [79, 44, 81, 45]],
	['water', [79, 44, 81, 45]],
	['living', [80, 44, 81, 45]],
	['food', [80, 44, 81, 45]],
	['energy', [80, 44, 81, 44]],
	['living', [80, 44, 80, 44]],
	['water', [80, 44, 80, 44]]
];
/** New stories on top of the stock, and infill on free town cells. */
const ADDITIONS: readonly (readonly [Use, Rect])[] = [
	['energy', [86, 46, 88, 47]],
	['food', [92, 47, 95, 48]],
	['food', [93, 47, 94, 48]],
	['water', [77, 42, 78, 43]],
	['living', [84, 40, 85, 41]],
	['material', [96, 40, 98, 42]],
	['living', [88, 43, 90, 44]],
	['living', [88, 43, 89, 44]],
	['energy', [81, 38, 83, 39]],
	['water', [93, 38, 95, 39]]
];
const CAPSULES = [
	{ use: 'water', cells: ['83/44', '84/44', '85/44'] },
	{ use: 'energy', cells: ['92/45', '93/45', '94/45'] }
] as const;
const TUBE = ['88/36', '88/25'];
const WALKWAY = ['75/48', '76/48', '83/48', '84/46', '88/45', '91/44', '92/44'];
const COVERS: readonly (readonly [Cover, Rect])[] = [
	['field', [60, 27, 70, 32]],
	['meadow', [72, 27, 86, 31]],
	['field', [90, 27, 99, 32]],
	['meadow', [101, 28, 112, 32]],
	['forest', [101, 41, 106, 46]],
	['forest', [62, 38, 68, 45]],
	['forest', [110, 22, 114, 26]],
	['meadow', [60, 22, 64, 25]]
];

// One painted crown starter per connected bank group gives the surrounding two-storey
// parcels room to alternate within the two-storey surcharge limit.
const BANK_CROWN_STARTERS = ['66/25', '78/25', '88/23', '106/24'];
const FRAME: readonly [Vec3, Vec3] = [
	[-30, -190, 1],
	[165, -62, 30]
];

const PORTRAIT_FRAME: readonly [Vec3, Vec3] = [
	[12, -185, 1],
	[84, -72, 34]
];

function townFormEdits({ grid, seed, state }: World): Edit[] {
	const reserved = new Set([
		...state.stacks.keys(),
		...[...TOWER, ...ADDITIONS, ...COVERS].flatMap(([, rect]) => cellsIn(rect)),
		...CAPSULES.flatMap(({ cells }) => cells),
		...TUBE,
		...WALKWAY,
		...TWO_SUNS_CELLS
	]);
	const plan = planTownForms(grid, seed, reserved);
	if (!plan) return [];
	return [
		...[...plan.runs.flat(), ...plan.satellite].flatMap(({ cellId, stories }) =>
			stories.map((use) => composedStory(cellId, use))
		),
		{ kind: 'line', transit: 'viaduct', cellIds: plan.railCellIds }
	];
}

function interventions(start: World, townEdits: Edit[]): Edit[] {
	return [
		...[...TOWER, ...ADDITIONS].flatMap(([use, rect]) => story(use, rect)),
		...CAPSULES.flatMap(({ use, cells }) =>
			cells.map((cellId): Edit => ({ kind: 'raise', cellId, use, style: 'totem' }))
		),
		...townEdits,
		{ kind: 'line', transit: 'capsule', cellIds: TUBE },
		...COVERS.flatMap(([kind, rect]) => cover(kind, rect)),
		...(start.seed === SEED ? BANK_CROWN_STARTERS.map((id) => composedStory(id, 'living')) : [])
	];
}

function elevatedWalkway({ grid }: World): Primitive[] {
	const ground = WALKWAY.map((id) => {
		const cell = grid.cellsById.get(id);
		if (!cell) throw new Error(`Missing acceptance cell ${id}`);
		return cell.center;
	});
	const groundZ = Math.min(...ground.map((point) => point[2]));
	const entryZ = Math.max(ground[0][2], ground[1][2]) + 0.25;
	const exitZ = Math.max(ground[ground.length - 1][2], ground[ground.length - 2][2]) + 0.25;
	const deckZ = Math.max(...ground.map((point) => point[2])) + 6;
	// Flat terminal spans are the landings. The next spans step up to the level deck.
	const route = ground.map(([x, y], i): Vec3 => [
		x,
		y,
		i < 2 ? entryZ : i >= ground.length - 2 ? exitZ : deckZ
	]);
	return walkwayParts(route, {
		id: 'acceptance-walkway',
		width: 3.4,
		groundZ,
		simplifyAtCity: true
	}).map((part) => (part.kind === 'prism' ? { ...part, finish: 'kunststoff-formteil' } : part));
}

/** Projects two frame generations and the fixed drafting details over a supplied town. */
export function draftingStudy(placed: World) {
	const first = {
		...placed,
		state: { ...placed.state, ...advanceFrames(placed, placed.state.year - 1) }
	};
	const world = { ...first, state: { ...first.state, ...advanceFrames(first, placed.state.year) } };
	return studyView(world);
}

function studyView(world: World) {
	return {
		world,
		earliestFullYear: world.state.year,
		additions: [
			...(world.state.city?.walk ? [] : elevatedWalkway(world)),
			...(world.seed === SEED ? twoSuns(world) : [])
		],
		frame: FRAME,
		portraitFrame: PORTRAIT_FRAME
	};
}

/** Builds the authored riverside stock before city expansion, including its first rail. */
export function riversideStock(start: World) {
	return interventions(start, townFormEdits(start)).reduce(applyEdit, start);
}

/** Opens the generated city with the reference valley’s planted banks on seed 7. */
export function openingScene(seed: number) {
	const start = createWorld(seed);
	const covers = seed === SEED ? COVERS.flatMap(([kind, rect]) => cover(kind, rect)) : [];
	const town = openCity(covers.reduce(applyEdit, start), seed === SEED ? TWO_SUNS_CELLS : []);
	return {
		world: town,
		additions: [] as Primitive[],
		referenceCellId: town.state.city?.centres[0]?.lots[0]
	};
}

/** Frames the same city as the game and adds the seed-7 kinetic landmark. */
export function acceptanceScene(seed = SEED) {
	const { world } = openingScene(seed);
	const waterfront = world.state.city?.centres.find(
		(centre) => centre.landmark.object === 'water-tower'
	);
	return {
		...studyView(world),
		...(waterfront && { featuredCentre: { cellId: waterfront.cellId, headingDeg: 196 } })
	};
}
