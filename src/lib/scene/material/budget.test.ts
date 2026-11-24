import { expect, test } from 'bun:test';
import {
	buildSurface,
	createSampleBoard,
	createSampleBody,
	familyNames,
	readFamily,
	readLight,
	readSurfaceLevel,
	surfaceControls,
	triangleBudgets,
	type Patch
} from './index';

const light = readLight([0.6, 0.8], 0.6);

test('plates and bodies stay within their triangle budgets at the finest module', () => {
	const options = {
		light,
		moduleScale: surfaceControls.moduleScale[0],
		reliefScale: surfaceControls.reliefScale[1]
	};
	const board = createSampleBoard(
		familyNames.map((family) => ({ family })),
		options
	);
	for (const surface of board.surfaces)
		expect(surface.triangles).toBeLessThanOrEqual(triangleBudgets.plate);
	for (const family of familyNames.filter((name) => !readFamily(name).ground)) {
		const body = createSampleBody(family, options);
		expect(body.triangles).toBeLessThanOrEqual(triangleBudgets.body);
	}
});

test('a patch over budget coarsens its module, then falls back to the flat level', () => {
	const patch: Patch = {
		origin: [0, 0, 0],
		across: [1, 0, 0],
		normal: [0, -1, 0],
		size: [4, 3],
		thickness: 0.1
	};
	const coarse = buildSurface('masonry', { ...patch, budget: 400 });
	expect(coarse.moduleScale).toBeGreaterThan(1);
	expect(coarse.triangles).toBeLessThanOrEqual(400);
	const flat = buildSurface('masonry', { ...patch, budget: 2 });
	expect(flat.level).toBe('flat');
});

test('levels drop from relief to a flat slab to a slab with pencil joints', () => {
	const patch: Patch = {
		origin: [0, 0, 0],
		across: [1, 0, 0],
		normal: [0, -1, 0],
		size: [2, 2],
		thickness: 0.1
	};
	const relief = buildSurface('timber', patch, { light });
	const flat = buildSurface('timber', patch, { level: 'flat' });
	const pencil = buildSurface('timber', patch, { level: 'pencil' });
	expect([...flat.meshes.keys()]).toEqual(['unit']);
	expect(flat.lines).toEqual([]);
	expect(pencil.meshes.get('unit')).toEqual(flat.meshes.get('unit'));
	expect(pencil.lines.length % 6).toBe(0);
	expect(pencil.lines.length).toBeGreaterThan(0);
	expect(flat.triangles).toBeLessThan(relief.triangles);
	expect(
		['full', 'silhouette', 'transparent', 'pencil', 'hidden'].map((level) =>
			readSurfaceLevel(level as never)
		)
	).toEqual(['relief', 'flat', 'flat', 'pencil', undefined]);
});
