import { expect, test } from 'bun:test';
import { assetRegistry, getAssetSurface } from './index';
import { finishCatalogue } from '../material/surface';

test('every surface preset resolves a sandbox finish', () => {
	const ids = new Set<string>(finishCatalogue.map((m) => m.id));
	for (const entry of assetRegistry.filter((e) => e.category === 'surfaces'))
		for (const v of entry.variants) expect(ids.has(getAssetSurface(entry.id, v).finish)).toBe(true);
});
