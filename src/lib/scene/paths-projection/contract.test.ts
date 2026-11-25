import { pathsFocusPreset, railSurfaces } from './index';
import { expect, test } from 'bun:test';
import { createMovementNetwork } from '../../domain/movement-network';
import { projectMovement } from './index';
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
