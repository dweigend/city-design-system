// @ts-expect-error Bun supplies the test API.
import { expect, spyOn, test } from 'bun:test';
import * as hardware from '../megastructure';
import { moduleGroup, type ModuleRod } from './module-group';

function survey(count: number, blocked: number, ceiling = false) {
	const rods = Array.from({ length: count }, (_, i): ModuleRod & { cell: string } => ({
		a: [0, 20 * i, 0],
		b: [18, 20 * i, 0],
		radius: 0.09,
		cell: i + '/40'
	}));
	const stock: hardware.Bounds[] = [
		{ min: [-10, -10, 0.09], max: [28, 20 * (blocked - 1) + 7, 8] }
	];
	if (ceiling) stock.push({ min: [-10, -10, 3.2], max: [28, 20 * count, 8] });
	const probe = spyOn(hardware, 'dockModule');
	try {
		const result = moduleGroup(rods, rods, 'water', stock, 1.5, { seed: 7, cell: (r) => r.cell });
		// Five stations per rod, one lower shell and at most two upper recipes.
		expect(probe.mock.calls.length).toBeLessThanOrEqual(25 * count);
		return result;
	} finally {
		probe.mockRestore();
	}
}
test('two blocked rows leave the third row available to the water group', () => {
	const result = survey(3, 2);
	expect(result?.map((p) => p.rod.cell)).toEqual(['2/40', '2/40', '2/40']);
	expect(result?.map((p) => p.recipe)).toEqual(['capsule', 'capsule', 'ceramic']);
});
test('an obstructed ceramic can use the late tank seat within the same linear survey budget', () => {
	expect(survey(15, 15, true)).toBeUndefined();
	expect(survey(15, 14)?.at(-1)?.recipe).toBe('ceramic');
	const result = survey(15, 14, true);
	expect(result?.map((p) => p.rod.cell)).toEqual(['14/40', '14/40', '14/40']);
	expect(result?.map((p) => p.recipe)).toEqual(['capsule', 'capsule', 'tank']);
});
