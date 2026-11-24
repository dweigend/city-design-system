import { expect, test } from 'bun:test';
import { buildAsset } from '../../world/asset-registry';
import { example } from './example';

test('keeps the town frame reversible and adds only a draped marker for the hovered parcel', () => {
	const { projection, parcel } = example();
	const [x, y] = parcel.outline[0];
	const [wx, wy] = projection.toWorld(...projection.toLocal(x, y));
	expect(wx).toBeCloseTo(x);
	expect(wy).toBeCloseTo(y);
	const marker = projection.projectHover(parcel);
	expect(marker.strokeSegments?.length).toBeGreaterThanOrEqual(parcel.outline.length * 6);
	expect(projection.background.some(({ id }) => id === marker.id)).toBe(false);
});

test('projects a placed walkway and platform with the Paths role colors', () => {
	const { projection } = example();
	const walkway = buildAsset(
		'access/walkway',
		{
			kind: 'graph-edge',
			id: 'walk',
			points: [
				[0, 0, 3],
				[10, 0, 3]
			],
			supports: [{ base: [0, 0, 0], top: [0, 0, 3] }]
		},
		{},
		1
	);
	expect(
		projection.projectPlacement(walkway, 'access', 'walk-placement').map(({ color }) => color)
	).toEqual(['--path', '--path']);
	const platform = buildAsset(
		'rail/platform',
		{
			kind: 'graph-edge',
			id: 'alignment',
			points: [
				[0, 0, 1],
				[10, 0, 1]
			]
		},
		{},
		1
	);
	const parts = projection.projectPlacement(platform, 'rail', 'placement-1');
	expect(parts.map(({ id, color }) => [id, color])).toEqual([
		['["placement-1","platform"]', '--cat-mobility'],
		['["placement-1","bearing"]', '--cat-mobility-5']
	]);
});
