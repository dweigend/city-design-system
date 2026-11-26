import { pathsFocusPreset, railSurfaces } from './index';
import { expect, test } from 'bun:test';
import { createMovementNetwork } from '../../domain/movement-network';
import {
	paintServicePipe,
	projectMovement,
	projectServicePipe,
	projectWalkableTube
} from './index';
import { pathsProjectionExample } from './example';

test('projects decks and bearings through distinct role slots in the local meter frame', () => {
	const { object, drawables } = pathsProjectionExample();
	expect(object.parts.map(({ slot }) => slot)).toEqual(['path-walkways', 'path-supports']);
	expect(object.anchors.map(({ position }) => position)).toEqual([
		[0, 0, 2],
		[10, 0, 2]
	]);
	expect(drawables.every(({ color }) => color === '--path')).toBe(true);
});

test('an offset bearing has a crosshead that reaches the downstream dock', () => {
	const graph = createMovementNetwork(
		[
			{ id: 'station', level: 1, position: [0, 0, 49] },
			{ id: 'approach', level: 1, position: [-20, 0, 49] }
		],
		[
			{
				id: 'dock',
				kind: 'walkway',
				nodeIds: ['station', 'approach'],
				cost: 20,
				supports: [{ base: [0, 17.36, 0], top: [0, 0, 49] }]
			}
		]
	);
	const { object } = projectMovement(
		graph,
		{ walkway: 'deck' },
		{
			toLocal: (x, y) => [x, y],
			footprint: { width: 80, depth: 80 }
		}
	);
	const shape = object.parts.find(({ slot }) => slot === 'path-supports')?.shape;
	if (shape?.kind !== 'mesh') throw Error('Expected a bearing mesh');
	const reachesDock = shape.positions.some(
		(_, i, positions) =>
			i % 3 === 0 && Math.abs(positions[i]) < 1 && positions[i + 1] === 0 && positions[i + 2] === 49
	);
	expect(reachesDock).toBe(true);
});

test('the Paths preset shows parcel widths with rail and stairs in plan', () => {
	const { readFocusLevel, selectFocus } = pathsFocusPreset;
	const present = ['terrain', 'water', 'lanes', 'parcels', 'walkways', 'transit', 'block'];
	expect(selectFocus(present, 'plan', 'paths').active).toBe('plan');
	for (const part of ['lanes', 'parcels', 'walkways', 'transit'])
		expect(readFocusLevel('plan', part)).toBe('full');
	expect(readFocusLevel('rail', 'walkways')).toBe('hidden');
	expect(readFocusLevel('paths', 'parcels')).toBe('hidden');
});

test('pins the rail platform and bearing palette tokens', () => {
	expect(railSurfaces.platform.color).toBe('--cat-mobility');
	expect(railSurfaces.bearing.color).toBe('--cat-mobility-5');
});

test('projects the pedestrian deck, glazing and ribs at human scale beside a compact service', () => {
	const run = [
		[0, 0, 5],
		[5, 0, 5],
		[10, 0, 6]
	] as const;
	const walkable = projectWalkableTube('walkable', run, { startTransverse: [0, 1, 0] });
	const pipe = projectServicePipe('service', run, 'water');
	expect(walkable.object.slots).toEqual(['tube-deck', 'tube-glazing', 'tube-ribs']);
	expect(pipe.object.slots).toEqual(['service-pipe', 'service-collars']);
	expect(walkable.object.footprint.depth).toBeGreaterThan(3);
	expect(pipe.object.footprint.depth).toBeLessThan(0.5);
	expect(walkable.drawables.map(({ color, finish, opacity }) => [color, finish, opacity])).toEqual([
		['--path', 'matte', '--alpha-solid'],
		['--line', 'glass', '--alpha-glass'],
		['--path', 'matte', '--alpha-solid']
	]);
	expect(walkable.object.anchors[0].transverse).toEqual([0, 1, 0]);
	const ribs = walkable.object.parts[2].shape;
	const collars = pipe.object.parts[1].shape;
	if (ribs.kind !== 'mesh' || collars.kind !== 'mesh') throw Error('Expected fitting meshes');
	expect(ribs.positions.length).toBeGreaterThan(collars.positions.length);
});

test('service colors survive transparency and both displays share frozen geometry', () => {
	const flows = {
		water: '--cat-health',
		energy: '--cat-mobility',
		material: '--cat-living'
	} as const;
	for (const flow of ['water', 'energy', 'material'] as const) {
		const run = [
			[0, 0, 0],
			[1, 0, 0],
			[1, 0, 2]
		] as const;
		const projection = projectServicePipe(flow, run, flow, { jointIndices: [1] });
		expect(projection.drawables.every(({ visible }) => visible === false)).toBe(true);
		const revealed = paintServicePipe(projection, 'transparency');
		const hidden = paintServicePipe(projection, 'normal');
		expect(revealed.map(({ finish }) => finish)).toEqual(['matte', 'gloss']);
		for (const [i, drawable] of revealed.entries()) {
			expect(drawable.visible).toBe(true);
			expect(drawable.color).toBe(flows[flow]);
			expect(drawable.preserveColor).toBe(true);
			expect(drawable.opacity).toBe('--alpha-solid');
			expect(drawable.shape).toBe(projection.object.parts[i].shape);
			expect(hidden[i].shape).toBe(drawable.shape);
			expect(hidden[i].visible).toBe(false);
		}
	}
});

test('keeps walkable deck inside the glazing at a 90-degree bend and rejects invalid tube inputs', () => {
	const corner = [
		[0, 0, 5],
		[6, 0, 5],
		[6, 6, 5]
	] as const;
	const walkable = projectWalkableTube('corner', corner);
	const deck = walkable.object.parts[0].shape;
	if (deck.kind !== 'mesh') throw Error('Expected walkable deck mesh');
	for (let i = 0; i < deck.positions.length; i += 3) {
		const [x, y, z] = [deck.positions[i], deck.positions[i + 1], deck.positions[i + 2]];
		const station = i < 12 ? corner[0] : i < 24 ? corner[1] : corner[2];
		expect(Math.hypot(x - station[0], y - station[1], z - station[2])).toBeLessThan(1.7);
	}
	expect(() =>
		projectWalkableTube('vertical', [
			[0, 0, 0],
			[0, 0, 4]
		])
	).toThrow(RangeError);
	expect(() =>
		projectServicePipe(
			'bad',
			[
				[0, 0, 0],
				[2, 0, 0]
			],
			'steam' as never
		)
	).toThrow(RangeError);
	const pipe = projectServicePipe(
		'water',
		[
			[0, 0, 0],
			[2, 0, 0]
		],
		'water'
	);
	expect(() => paintServicePipe(pipe, 'wireframe' as never)).toThrow(RangeError);
});
