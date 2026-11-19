import { checkAssets } from '../../fixtures/asset-contract';
import { expect, test } from 'bun:test';
import { assetRegistry, getAssetSurface } from './index';
import { materialAusfuehrungen } from '../../data/materialAusfuehrung';
import { materials } from '../../data/material';
checkAssets('surfaces');
test('every surface preset resolves a sandbox finish', () => {
	const ids = new Set<string>([...materials, ...materialAusfuehrungen].map((m) => m.id));
	for (const entry of assetRegistry.filter((e) => e.category === 'surfaces'))
		for (const v of entry.variants) expect(ids.has(getAssetSurface(entry.id, v).finish)).toBe(true);
});
