import { checkProductionGroup } from './production-group.fixture.test';
checkProductionGroup('occupied-decks');

import { test, expect } from 'bun:test';
import { assetRegistry, buildObject } from '../../logic/assets';
test('occupied decks contain three to fifteen full-scale people', () => {
	for (const entry of assetRegistry.filter((a) => a.category === 'occupied-decks')) {
		const counts = entry.variants.map(
			(v) =>
				buildObject(entry.id, v, 1).geometry.filter(
					(g) =>
						g.kind === 'sphere' && g.slot === (entry.id.startsWith('stop-') ? 'figure' : 'body')
				).length
		);
		expect(counts).toEqual(entry.footprint[0] >= 7.5 ? [5, 10, 15] : [3, 6, 9]);
	}
});
