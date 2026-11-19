import { expect, test } from 'bun:test';
import { assetRegistry, buildObject, type AssetCategory } from '../../logic/assets';
import { checkAssets } from './asset-contract.fixture.test';

/** Exercises placement, seed determinism, physical profiles and replaceable slots for one production family. */
export function checkProductionGroup(group: AssetCategory) {
	checkAssets(group);
	test(group + ' offers seven designs in three reservable spans', () => {
		const entries = assetRegistry.filter((a) => a.category === group);
		expect(entries).toHaveLength(21);
		for (const entry of entries) {
			expect(entry.slotNames.length).toBeGreaterThanOrEqual(2);
			expect(entry.slotNames.length).toBeLessThanOrEqual(3);
			const used = new Set<string>();
			const signatures = entry.variants.map((v) => {
				const base = buildObject(entry.id, v, 0);
				const slots = Object.fromEntries(
					entry.slotNames.map((s) => [
						s,
						{ finish: 'holz-natur' as const, token: '--ink' as const }
					])
				);
				const dressed = buildObject(entry.id, v, 0, { slots });
				expect(dressed.geometry).toEqual(base.geometry);
				for (const [i, g] of base.geometry.entries()) {
					used.add(g.slot);
					if (g.kind === 'pipe') expect(2 * g.radius).toBeGreaterThanOrEqual(0.12);
					expect(dressed.parts[i].finish).toBe('holz-natur');
					expect(base.defaults[g.slot]).toBeDefined();
				}
				return JSON.stringify(base.geometry);
			});
			expect(new Set(signatures).size).toBe(3);
			expect([...used].sort()).toEqual([...entry.slotNames].sort());
		}
	});
}
