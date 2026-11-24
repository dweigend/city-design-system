import { expect, test } from 'bun:test';
import { specimenSettings as settings } from '../../config/surface-specimens';
import * as material from '../../lib/scene/material';
import { createSampleBoard } from './board';
import { createSampleBody } from './body';
import { groundFamily, readControl } from './controls';

const light = [0.36, 0.48, -1] as const;

test('the module query underflow clamps to the slider minimum before building', () => {
	const query = new URL('/surfaces?module=5e-324&relief=100&seed=-1', 'http://localhost')
		.searchParams;
	expect(readControl(query.get('module'), settings.moduleScaleBand)).toBe(
		settings.moduleScaleBand[0]
	);
	expect(readControl(query.get('relief'), settings.reliefScaleBand)).toBe(
		settings.reliefScaleBand[1]
	);
	expect(readControl(query.get('seed'), settings.seedBand)).toBe(settings.seedBand[0]);
});

test('plates and bodies stay within their triangle budgets at the finest module', () => {
	const options = {
		light,
		moduleScale: settings.moduleScaleBand[0],
		reliefScale: settings.reliefScaleBand[1]
	};
	const board = createSampleBoard(
		material.familyNames.map((family) => ({ family })),
		options
	);
	for (const surface of board.surfaces)
		expect(surface.triangles).toBeLessThanOrEqual(settings.plateTriangleBudget);
	for (const family of material.familyNames.filter((name) => name !== groundFamily)) {
		const body = createSampleBody(family, options);
		expect(body.triangles).toBeLessThanOrEqual(settings.bodyTriangleBudget);
	}
});

test('specimens, controls and presentation adapters are outside the material entry', () => {
	for (const name of [
		'createSampleBoard',
		'createSampleBody',
		'triangleBudgets',
		'surfaceControls',
		'readLight',
		'readSurfaceLevel'
	])
		expect(Object.hasOwn(material, name)).toBe(false);
	for (const family of material.familyNames)
		expect(Object.hasOwn(material.readFamily(family), 'ground')).toBe(false);
});
