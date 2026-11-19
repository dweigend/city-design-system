import { twoSuns } from './two-suns';
import { advanceFrames } from './frame-construction';
import { walkwayParts, WALKWAY_WIDTH_M } from '../walkway';
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
/** One story of colour bodies on every buildable cell of the rectangle. */
const story = (use: Use, rect: Rect): Edit[] =>
	cellsIn(rect).map((cellId) => ({ kind: 'raise', cellId, use, style: 'collage' }));
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
/** Riverside run on stilts along the bank, west to east; later entries stack on earlier ones. */
const RUN: readonly (readonly [Use, Rect])[] = [
	['water', [66, 24, 69, 25]],
	['water', [66, 24, 67, 25]],
	['living', [71, 23, 75, 24]],
	['living', [72, 23, 74, 24]],
	['energy', [73, 23, 73, 24]],
	['food', [77, 23, 80, 25]],
	['food', [78, 24, 79, 25]],
	['energy', [82, 22, 84, 23]],
	['living', [83, 22, 84, 23]],
	['water', [83, 22, 83, 22]],
	['living', [86, 22, 90, 23]],
	['material', [87, 22, 89, 23]],
	['material', [92, 22, 95, 24]],
	['living', [93, 22, 94, 23]],
	['water', [97, 23, 99, 24]],
	['living', [101, 24, 105, 25]],
	['food', [102, 24, 104, 25]],
	['energy', [103, 24, 103, 25]],
	['food', [107, 25, 109, 27]]
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
/** Satellite hamlet east of the town, reached by the rail. */
const SATELLITE: readonly (readonly [Use, Rect])[] = [
	['food', [116, 38, 119, 40]],
	['living', [117, 38, 118, 39]],
	['living', [121, 37, 123, 38]],
	['energy', [121, 37, 121, 38]],
	['material', [116, 42, 118, 43]]
];
const CAPSULES = [
	{ use: 'water', cells: ['83/44', '84/44', '85/44'] },
	{ use: 'energy', cells: ['92/45', '93/45', '94/45'] }
] as const;
const RAIL = ['62/35', '126/35'];
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
const OPENING_CELL = '79/44';
const FRAME: readonly [Vec3, Vec3] = [
	[-30, -190, 1],
	[165, -62, 30]
];

const PORTRAIT_FRAME: readonly [Vec3, Vec3] = [
	[12, -185, 1],
	[84, -72, 34]
];

function interventions(): Edit[] {
	return [
		...[...TOWER, ...RUN, ...ADDITIONS, ...SATELLITE].flatMap(([use, rect]) => story(use, rect)),
		...CAPSULES.flatMap(({ use, cells }) =>
			cells.map((cellId): Edit => ({ kind: 'raise', cellId, use, style: 'totem' }))
		),
		{ kind: 'line', transit: 'viaduct', cellIds: RAIL },
		{ kind: 'line', transit: 'capsule', cellIds: TUBE },
		...COVERS.flatMap(([kind, rect]) => cover(kind, rect))
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
	return walkwayParts(route, {
		id: 'acceptance-walkway',
		width: WALKWAY_WIDTH_M,
		groundZ,
		simplifyAtCity: true
	}).map((part) =>
		part.kind === 'cylinder' ? { ...part, role: 'traeger', bearings: [part.position] } : part
	);
}

/** Replays the seed-7 interventions and returns the fixed drafting study in world meters. */
export function acceptanceScene(seed = SEED) {
	const start = createWorld(seed);
	const placed = interventions().reduce(applyEdit, start);
	const first = {
		...placed,
		state: { ...placed.state, ...advanceFrames(placed, start.state.year - 1) }
	};
	const world = { ...first, state: { ...first.state, ...advanceFrames(first, start.state.year) } };
	return {
		world,
		earliestFullYear: start.state.year,
		additions: [...elevatedWalkway(world), ...(seed === SEED ? twoSuns(world) : [])],
		frame: FRAME,
		portraitFrame: PORTRAIT_FRAME
	};
}

/** Editable seed-7 opening: the drafting study's interventions on the stock town. */
export function openingScene(seed: number) {
	const start = createWorld(seed);
	if (seed !== SEED) return { world: start, additions: [], referenceCellId: undefined };
	const world = interventions().reduce(applyEdit, start);
	return { world, additions: elevatedWalkway(world), referenceCellId: OPENING_CELL };
}
