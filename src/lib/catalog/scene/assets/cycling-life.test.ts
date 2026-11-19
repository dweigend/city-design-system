import { test, expect } from 'bun:test';
import { assetRegistry, buildObject } from '../../logic/assets';
import { checkAssets } from './asset-contract.fixture.test';
checkAssets('cycling-life');
test('the five cycle scenes change their pedal phase while keeping replaceable surfaces', () => {
	const scenes = assetRegistry.filter((a) => a.category === 'cycling-life');
	expect(scenes).toHaveLength(5);
	for (const scene of scenes) {
		const signatures = scene.variants.map((v) => {
			const base = buildObject(scene.id, v, 17);
			const recoloured = buildObject(scene.id, v, 17, {
				slots: { coat: { finish: 'metall-messing', token: '--ink' } }
			});
			expect(base.geometry).toEqual(recoloured.geometry);
			expect(new Set(base.geometry.map((p) => p.slot))).toEqual(new Set(['coat', 'gear', 'skin']));
			for (const [i, g] of base.geometry.entries())
				if (g.slot === 'coat') expect(recoloured.parts[i].finish).toBe('metall-messing');
			expect(base.geometry.filter((g) => g.kind === 'sphere')).toHaveLength(3);
			expect(base.geometry.filter((g) => g.kind === 'ring')).toHaveLength(2);
			return JSON.stringify(base.geometry);
		});
		expect(new Set(signatures).size).toBe(3);
	}
});
