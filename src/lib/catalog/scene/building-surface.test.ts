import { expect, test } from 'bun:test';
import { materialSheet } from '../logic/material/contact-sheet';
import { applySurface } from '../logic/material/surface';
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
		expect(partition([shell], new Set(), true).finished).toEqual([expected]);
		expect(projectBuildingSurface(applySurface(shell, undefined, '--signal')).token).toBe(
			'--signal'
		);
		const painted = applySurface(shell, 'holz-natur', '--ink-3');
		expect(painted).toBe(projectBuildingSurface(painted));
		expect(projectBuildingSurface(applySurface(shell, 'city-drawing')).finish).toBeUndefined();
	}
});
