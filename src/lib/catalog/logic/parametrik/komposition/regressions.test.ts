// @ts-expect-error Bun test API is provided at runtime.
import { expect, test } from 'bun:test';
import { formFamilies } from '../formen';
import { gridGenerators } from '../raster';
import { compose, compositionRules } from './index';
import { gridPrimitives } from '../raster/operatoren';
import { heightBudget, primitiveTop } from './height';
import { createPatch } from '../eckraster/topology';
import { address } from '../eckraster/state';
import { slots } from '../eckraster/derive';
import { presentation } from '../eckraster/presentation';
import { eckModul } from '../formen/eck';
import type { Primitive } from '../types';
import { fitRect, inradius } from '../formen/geom';

test('cube stacks fill triangular and hexagonal cells at the same relative scale', () => {
	const family = formFamilies.find((f) => f.id === 'klotz-wuerfelstapel')!;
	for (const kind of ['triangle', 'hex']) {
		const grid = gridGenerators.find((g) => g.kind === kind)!.generate({}, 42);
		const cell = grid.cells[0];
		const single = { ...grid, cells: [cell], links: [] };
		const parts = compose(single, [compositionRules.find((r) => r.id === 'hof')!], [family]);
		const base = parts[0];
		const rect = fitRect(cell.polygon, cell.center, cell.orientation);
		expect(base.kind).toBe('box');
		if (base.kind === 'box') {
			expect(base.size[0]).toBeCloseTo(Math.min(rect.hu, rect.hv) * 2, 3);
			expect(base.size[1]).toBeCloseTo(base.size[0], 6);
		}
		expect(parts.length).toBe(4);
		expect(Math.max(...parts.map(primitiveTop)) - cell.level * 4).toBeLessThanOrEqual(
			(6 * inradius(cell.polygon, cell.center)) / 2.5 + 1e-6
		);
	}
});

function positive(p: Primitive) {
	if ('size' in p) expect(p.size.every((v) => v > 0)).toBe(true);
	for (const key of ['height', 'radius', 'width', 'length', 'rise', 'depth'] as const)
		if (key in p) expect((p as unknown as Record<string, number>)[key]).toBeGreaterThan(0);
	expect(JSON.stringify(p)).not.toContain('null');
}
test('small greenhouse and solar footprints retain positive dimensions', () => {
	for (const id of ['huelle-gewaechshaus', 'kopf-solarfeld'])
		for (const width of [0.2, 0.48, 0.7, 1.4, 4]) {
			const form = formFamilies.find((f) => f.id === id)!;
			const parts = form.generate(
				{
					footprint: [
						[0, 0],
						[width, 0],
						[width, 0.6],
						[0, 0.6]
					],
					center: [width / 2, 0.3],
					orientation: 0,
					z: 4,
					height: 2,
					role: 'neu',
					seed: 42
				},
				Object.fromEntries(form.params.map((p) => [p.key, p.default]))
			);
			parts.forEach(positive);
			for (const p of parts)
				if (p.kind === 'vault' && p.thickness)
					expect(p.thickness).toBeLessThan(Math.min(p.width / 2, p.rise));
		}
});
test('low pipe track omits zero height supports', () => {
	const form = formFamilies.find((f) => f.id === 'rohr-roehrenbahn')!;
	const parts = form.generate(
		{
			footprint: [
				[-5, -5],
				[5, -5],
				[5, 5],
				[-5, 5]
			],
			center: [0, 0],
			orientation: 0,
			z: 0,
			height: 4,
			role: 'neu',
			seed: 42
		},
		{ hoehe: 0.2, radius: 3, kapsel: 1 }
	);
	parts.forEach(positive);
	expect(parts.some((p) => p.kind === 'box')).toBe(false);
});
test('all 432 grid/rule/group combinations have valid dimensions', () => {
	const groups = [...new Set(formFamilies.map((f) => f.group))];
	let n = 0;
	for (const generator of gridGenerators)
		for (const rule of compositionRules)
			for (const group of groups) {
				const grid = generator.generate({}, 42);
				const parts = compose(
					grid,
					[rule],
					formFamilies.filter((f) => f.group === group)
				);
				parts.forEach(positive);
				n++;
			}
	expect(n).toBe(432);
}, 60000);
test('compositions and lifted plates fit below stacked stories', () => {
	const grid = gridGenerators.find((g) => g.kind === 'vertical')!.generate({}, 42);
	for (const rule of compositionRules) {
		const parts = compose(grid, [rule]);
		const links = new Set(grid.links.map(([a, b]) => `netz-${a}-${b}`));
		for (const cell of grid.cells)
			if (Number.isFinite(heightBudget(cell, grid)))
				for (const p of parts.filter(
					(p) => !links.has(p.id) && p.id.startsWith(`${rule.id}-${cell.id}-`)
				))
					expect(primitiveTop(p)).toBeLessThanOrEqual(cell.level * 4 + 4);
	}
	const plates = gridPrimitives(
		{ ...grid, cells: grid.cells.map((c) => ({ ...c, fields: { density: 1 } })) },
		10
	);
	for (const cell of grid.cells)
		if (Number.isFinite(heightBudget(cell, grid))) {
			const plate = plates.find((p) => p.id === `plate-${cell.id}`)!;
			expect(primitiveTop(plate)).toBeLessThan(cell.level * 4 + 4);
		}
});

test('food and energy heads fit every L10 building cell', () => {
	const patch = createPatch();
	for (const group of ['nahrung', 'energie'])
		for (const vertex of patch.vertices) {
			const occupancy = Object.fromEntries(
				[0, 1].map((level) => [address(vertex.id, level), { occupied: true, group }])
			);
			presentation(patch, occupancy, slots(patch, occupancy), eckModul, false, false).forEach(
				positive
			);
		}
});
