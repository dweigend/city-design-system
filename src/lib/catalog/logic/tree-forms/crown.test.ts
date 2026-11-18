// @ts-expect-error Bun provides this test API at runtime.
import { test, expect } from 'bun:test';
import { crownParts } from './index';
const base = () => ({ id: 'crown', role: 'neu', token: '--cat-nature', material: 'wood' }) as const;
test('a ball rests on the crown base', () =>
	expect(crownParts('ball', [1, 2, 4], 2, base)[0]).toMatchObject({
		position: [1, 2, 5.2],
		radius: 1.2
	}));
test('a cone rises from its base', () =>
	expect(crownParts('cone', [1, 2, 4], 2, base)[0]).toMatchObject({
		position: [1, 2, 4],
		height: 3.6
	}));
test('voxel crowns allocate six successive identities', () =>
	expect(
		crownParts('voxel', [0, 0, 0], 1, (i) => ({ ...base(), id: String(i) })).map((p) => p.id)
	).toEqual(['0', '1', '2', '3', '4', '5']));
test('a spiral has a tapered band of two and a half turns', () =>
	expect(crownParts('spiral', [1, 2, 4], 2, base)[0]).toMatchObject({
		kind: 'helix',
		turns: 2.5,
		height: 3.2,
		innerRadius: 0.24
	}));
