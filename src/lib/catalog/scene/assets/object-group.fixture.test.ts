import { expect, test } from 'bun:test';
import { assetRegistry, buildAsset, type AssetCategory } from '../../logic/assets';
import { checkAssets } from './asset-contract.fixture.test';

/** Checks the placement contract plus structural differences after stripping surface fields. */
export function checkObjectGroup(category: AssetCategory) {
	checkAssets(category);
	test(category + ' contains ten individually registered designs with distinct geometry', () => {
		const entries = assetRegistry.filter((a) => a.category === category);
		expect(entries).toHaveLength(10);
		for (const entry of entries) {
			expect(assetRegistry.filter((a) => a.id === entry.id)).toHaveLength(1);
			const signatures = entry.variants.map((v) =>
				JSON.stringify(buildAsset(entry.id, v, 17), (key, value: unknown) =>
					['id', 'material', 'finish', 'token'].includes(key) ? undefined : value
				)
			);
			expect(new Set(signatures).size).toBe(entry.variants.length);
		}
	});
}
