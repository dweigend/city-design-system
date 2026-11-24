import { expect, test } from 'bun:test';
import { buildAsset } from '../../world/asset-registry';
import { accessSurfaces, railSurfaces } from '../paths-projection';
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

test.each([
	{
		assetId: 'access/walkway',
		kind: 'access',
		points: [
			[0, 0, 3],
			[10, 0, 3]
		],
		roles: { deck: accessSurfaces.deck, bearing: accessSurfaces.bearing }
	},
	{
		assetId: 'access/stair',
		kind: 'access',
		points: [
			[0, 0, 3],
			[10, 0, 6]
		],
		roles: { stairs: accessSurfaces.stairs, bearing: accessSurfaces.bearing }
	},
	{
		assetId: 'rail/platform',
		kind: 'rail',
		points: [
			[0, 0, 3],
			[10, 0, 3]
		],
		roles: { platform: railSurfaces.platform, bearing: railSurfaces.bearing }
	}
] as const)(
	'projects $assetId with the full Paths role surfaces',
	({ assetId, kind, points, roles }) => {
		const { projection } = example();
		const object = buildAsset(
			assetId,
			{
				kind: 'graph-edge',
				id: 'alignment',
				points,
				supports: [{ base: [0, 0, 0], top: [0, 0, 3] }]
			},
			{},
			1
		);
		const parts = projection.projectPlacement(object, kind, 'placement-1');
		expect(parts).toEqual(
			Object.entries(roles).map(([slot, surface], index) => ({
				id: JSON.stringify(['placement-1', slot]),
				shape: parts[index]?.shape,
				...surface
			}))
		);
	}
);
