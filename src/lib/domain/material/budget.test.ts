import { expect, test } from 'bun:test';
import { materialSettings } from '../../../config/material';
import { buildSurface, familyNames, fitModuleScale, surfaceLevels, type Patch } from './index';

const patch: Patch = {
	origin: [0, 0, 0],
	across: [1, 0, 0],
	normal: [0, -1, 0],
	size: [2, 2],
	thickness: 0.1
};

test('marks coarsen to fit an explicit budget and the fitted scale predicts it', () => {
	const tight = { ...patch, size: [4, 3] as const, budget: 160 };
	const coarse = buildSurface('perforated', tight, { level: 'near' });
	expect(coarse.moduleScale).toBeGreaterThan(1);
	expect(coarse.triangles).toBeLessThanOrEqual(160);
	expect(fitModuleScale('perforated', tight)).toBeGreaterThan(1);
});

test('every family and level omits geometry below the minimum budget', () => {
	for (const family of familyNames)
		for (const level of surfaceLevels) {
			for (const small of [{ ...patch, budget: 2 }, { ...patch, size: [0.1, 0.1] } as const]) {
				const result = buildSurface(family, small, { level });
				expect(result.triangles).toBe(0);
				expect(result.lines).toEqual([]);
			}
			const minimum = buildSurface(
				family,
				{ ...patch, budget: materialSettings.minimumMeshTriangles },
				{ level }
			);
			expect(minimum.triangles).toBe(materialSettings.minimumMeshTriangles);
		}
});

test('a kilometer patch preflights its marks and falls back to the plain face', () => {
	const kilometer: Patch = { ...patch, size: [1000, 1000], budget: 5000 };
	const result = buildSurface('perforated', kilometer, { level: 'near' });
	expect([...result.meshes.keys()]).toEqual(['face']);
	expect(result.triangles).toBe(12);
});

test('a homogeneous face costs a slab: twelve triangles without openings', () => {
	for (const family of ['board', 'card', 'cork', 'ground'] as const)
		expect(buildSurface(family, patch, { level: 'mid' }).triangles).toBe(12);
	expect(buildSurface('board', { ...patch, backed: false }, { level: 'mid' }).triangles).toBe(2);
});
