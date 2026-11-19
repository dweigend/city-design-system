import { expect, test } from 'bun:test';
import { assetRegistry, buildObject } from './index';

test('saved figure overrides work on scale figures and their terrace hosts', () => {
	const figure = { finish: 'metall-messing', token: '--paper' } as const;
	for (const id of ['scale-figure', 'roof-terrace', 'walkway-stop']) {
		const entry = assetRegistry.find((asset) => asset.id === id);
		if (!entry) throw new Error('Missing public asset: ' + id);
		expect(entry.slotNames).toContain('figure');
		for (const variant of entry.variants) {
			const base = buildObject(id, variant, 17);
			const dressed = buildObject(id, variant, 17, { slots: { figure } });
			expect(dressed.geometry).toEqual(base.geometry);
			expect(base.geometry.some((p) => p.slot === 'figure')).toBe(true);
			for (const [i, part] of base.geometry.entries()) {
				if (part.slot === 'figure') expect(dressed.parts[i]).toMatchObject(figure);
				else expect(dressed.parts[i]).toEqual(base.parts[i]);
			}
		}
	}
});
