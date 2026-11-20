import { expect, test } from 'bun:test';
import { materialSheet } from '../logic/material/contact-sheet';
import { ACCENT_TOKEN, GROUND_TOKEN } from '../data/house-body';
import { applySurface, resolveFinish } from '../logic/material/surface';
import { projectBuildingSurface } from './building-surface';
import { partition } from './sandbox/structure-layers';

test('the bible shell and city batch receive the same projected ensemble finish', () => {
	const [shells] = materialSheet('--paper');
	for (const sample of shells.samples) {
		const parts = sample.parts();
		const shell = parts.find((p) => p.buildingSurface?.slot === 'shell');
		if (!shell) throw new Error('Missing shell on ' + sample.id);
		const expected = projectBuildingSurface(shell);
		expect(shell.finish).toBeUndefined();
		expect(expected.colourRole).toBe('ensemble-ground');
		expect(partition([shell], new Set(), true).finished as unknown[]).toEqual([expected]);
		expect(projectBuildingSurface(applySurface(shell, undefined, '--signal')).token).toBe(
			'--signal'
		);
		const painted = applySurface(shell, 'holz-natur', '--ink-3');
		expect(painted).toBe(projectBuildingSurface(painted));
		expect(projectBuildingSurface(applySurface(shell, 'city-drawing')).finish).toBeUndefined();
	}
});

test('a water court and a food accent retain their pigments through the physical finish', () => {
	const [part] = materialSheet('--paper')[0].samples[0].parts();
	const shell = { slot: 'shell', use: 'water', ensemble: 'court-A' } as const;
	for (const [context, token, paper] of [
		[shell, GROUND_TOKEN.water, 0.14],
		[{ ...shell, accentUse: 'food' }, ACCENT_TOKEN.food, 0]
	] as const) {
		const resolved = projectBuildingSurface({ ...part, buildingSurface: context });
		if (!resolved.finish) throw Error('Missing building finish');
		const finish = resolveFinish(resolved.finish, resolved.token, 0, resolved.colourRole);
		if (finish.kind !== 'physical') throw Error('Expected a painted physical finish');
		expect(finish.recipe.farbe).toMatchObject({ token, papier: paper, anteil: 1 });
	}
});
