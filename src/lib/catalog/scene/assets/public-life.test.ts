import { expect, test } from 'bun:test';
import { assetRegistry, buildObject } from '../../logic/assets';
import { checkObjectGroup } from './object-group.fixture.test';

checkObjectGroup('public-life');
test('action figures keep their posed joints when coat and skin finishes change', () => {
	for (const entry of assetRegistry.filter((a) => a.category === 'public-life')) {
		for (const variant of entry.variants) {
			const base = buildObject(entry.id, variant, 17);
			const dressed = buildObject(entry.id, variant, 17, {
				slots: {
					coat: { finish: 'metall-messing', token: '--ink' },
					skin: { finish: 'keramik-glasiert', token: '--paper' }
				}
			});
			expect(dressed.geometry).toEqual(base.geometry);
			expect(new Set(base.geometry.map((p) => p.slot))).toEqual(new Set(['gear', 'coat', 'skin']));
			expect(
				base.geometry.filter((p) => p.kind === 'capsule' && p.slot === 'coat').length
			).toBeGreaterThanOrEqual(5);
			for (const [i, p] of base.geometry.entries()) {
				const finish =
					p.slot === 'coat'
						? 'metall-messing'
						: p.slot === 'skin'
							? 'keramik-glasiert'
							: base.defaults.gear.finish;
				expect(dressed.parts[i].finish).toBe(finish);
			}
		}
	}
});
