import { expect, test } from 'bun:test';
import { assetRegistry } from '../assets';
import { bounds } from '../ansicht/geometrie';
import { place } from './asset-fit';
import { houseObject } from './house-object';

test('every registered object variant mounts as a house fitting with finite geometry', () => {
	const kinds = new Set<string>();
	let variants = 0;
	for (const asset of assetRegistry)
		for (const variant of asset.variants) {
			const slots = Object.fromEntries(
				asset.slotNames.map((name) => [name, { token: '--paper', finish: 'metal' } as const])
			);
			const { parts } = houseObject(asset.id, variant, 17, { instanceId: 'fit', slots });
			const fitted = place(parts, [0, 0, 0], [12, -7, 8], [1.1, 1.1, 1.1], 0.6);
			expect(fitted).toHaveLength(parts.length);
			for (const part of fitted) {
				kinds.add(part.kind);
				const box = bounds(part);
				expect([...box.min, ...box.max].every(Number.isFinite)).toBe(true);
			}
			variants++;
		}
	expect(variants).toBeGreaterThan(1000);
	expect(kinds.size).toBeGreaterThan(8);
});
