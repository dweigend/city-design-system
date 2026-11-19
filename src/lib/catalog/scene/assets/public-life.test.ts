import { expect, test } from 'bun:test';
import { assetRegistry, buildObject } from '../../logic/assets';
import { checkObjectGroup } from './object-group.fixture.test';
checkObjectGroup('public-life');
test('staffage has one head and a single finish across all anatomical parts', () => {
	for (const a of assetRegistry.filter((x) => x.category === 'public-life'))
		for (const v of a.variants) {
			const base = buildObject(a.id, v, 17),
				person = base.geometry.filter((p) => p.slot === 'coat');
			expect(person.length).toBeLessThanOrEqual(6);
			expect(base.geometry.length - person.length).toBeLessThanOrEqual(3);
			const heads = person.filter((p) => p.kind === 'sphere');
			expect(heads).toHaveLength(1);
			const head = heads[0],
				h = head.position[2] + head.radius;
			expect((2 * head.radius) / h).toBeCloseTo(a.id === 'kick-scooter-child' ? 0.16 : 0.13, 4);
			const assigned = buildObject(a.id, v, 17, {
				slots: { coat: { finish: 'metall-messing', token: '--ink' } }
			});
			expect(assigned.geometry).toEqual(base.geometry);
			for (const [i, g] of base.geometry.entries())
				if (g.slot === 'coat') expect(assigned.parts[i].finish).toBe('metall-messing');
		}
});
