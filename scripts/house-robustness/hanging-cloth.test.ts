import { resolveFinish } from '../../src/lib/catalog/logic/material/surface';
import { oberflaechenWerte } from '../../src/lib/catalog/logic/material/ausfuehrung';
import { expect, test } from 'bun:test';
import { hangingCloth } from '../../src/lib/catalog/logic/membrane';

for (const style of ['suspended-curtain', 'tensile-sail'] as const) {
	test(style + ' hangs from its attachments and moves in all three directions', () => {
		const fabric = { restraint: 'straps', pressure: 0, tension: 1 } as const;
		const { positions, faces } = hangingCloth(style, 12, 18, fabric);
		const loaded = hangingCloth(style, 12, 18, { ...fabric, pressure: 0.08 });
		const used = [...new Set(faces)];
		expect(positions[0]).toEqual(loaded.positions[0]);
		expect(positions[16 * 17]).toEqual(loaded.positions[16 * 17]);
		expect(
			Math.max(...used.map((i) => Math.abs(positions[i][0] - ((i % 17) * 12) / 16)))
		).toBeGreaterThan(0.01);
		expect(
			Math.max(...used.map((i) => (Math.floor(i / 17) * 18) / 16 - positions[i][1]))
		).toBeGreaterThan(0.05);
		expect(Math.max(...used.map((i) => loaded.positions[i][2] - positions[i][2]))).toBeGreaterThan(
			0.05
		);
		for (const i of used) expect(loaded.positions[i].every(Number.isFinite)).toBe(true);
	});
}

test('opposite sail grips alternate in depth and the free edges draw inward', () => {
	const { positions } = hangingCloth('tensile-sail', 12, 18, {
		pressure: 0,
		tension: 1,
		restraint: 'straps'
	});
	expect(positions[0][2]).toBeGreaterThan(positions[16][2]);
	expect(positions[288][2]).toBeGreaterThan(positions[272][2]);
	expect(positions[8 * 17][0]).toBeGreaterThan(0.4);
	expect(positions[8 * 17 + 16][0]).toBeLessThan(11.6);
});

test('woven cladding and pneumatic film transmit light with their ensemble pigment', () => {
	for (const id of ['membran-voile', 'membran-film'] as const) {
		const finish = resolveFinish(id, '--ground-clay', 0, 'ensemble-ground');
		if (finish.kind !== 'physical') throw Error('Missing textile material');
		const cloth = oberflaechenWerte(finish.recipe, finish.id);
		expect(cloth.transmission).toBeGreaterThan(0);
		expect(cloth.deckkraft).toBeLessThan(1);
		expect(cloth.deckkraft).toBeGreaterThan(0);
		expect(finish.recipe.farbe.token).toBe('--ground-clay');
	}
});
