// @ts-expect-error Bun provides the test API.
import { expect, test } from 'bun:test';
import type { Primitive } from '../parametrik/types';
import { present, focuses } from './index';

const mass: Primitive = {
	kind: 'box',
	id: 'house',
	role: 'neu',
	token: '--cat-health',
	material: 'concrete',
	position: [0, 0, 0],
	size: [5, 5, 4]
};
const parts = [mass, { ...mass, id: 'window', detail: true }];

test('five views of the same mass and window', () => {
	expect(present(parts, 'full')).toEqual(parts);
	expect(present(parts, 'silhouette')).toEqual([mass]);
	expect(present(parts, 'transparent')[0].material).toBe('ghost');
	expect(present(parts, 'pencil')[0]).toMatchObject({ role: 'bestand', token: '--paper' });
	expect(present(parts, 'hidden')).toEqual([]);
});
test('infrastructure emphasizes paths and rail over houses', () => {
	expect(focuses.infrastructure).toMatchObject({ rail: 'full', paths: 'full', houses: 'pencil' });
});
