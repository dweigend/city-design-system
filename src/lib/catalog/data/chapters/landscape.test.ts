import { describe, expect, test } from 'bun:test';
import { resolveView } from '../../logic/view-modes';
import { designPrinciples } from '../design-principles';
import { VALLEY_PICTURE_SEEDS } from '../valley-references';
import { displayModes, viewModes } from '../view-modes';
import { landscapeChapter } from './index';

describe('landscape chapter steps', () => {
	test('keeps the lead and two studies in anchor order with one starting seed', () => {
		expect(landscapeChapter.steps.map((step) => step.id)).toEqual([
			'step-0',
			'step-1',
			'step-2',
			'step-3',
			'step-4'
		]);
		expect(landscapeChapter.steps.map((step) => step.control.kind)).toEqual([
			'playback',
			'seed',
			'view',
			'view',
			'view'
		]);
		expect(landscapeChapter.steps[1].control.seeds).toEqual(VALLEY_PICTURE_SEEDS);
		for (const step of landscapeChapter.steps) {
			expect(step.preset.seed).toBe(VALLEY_PICTURE_SEEDS[0]);
			expect(step.title.split(/\s+/).length).toBeLessThanOrEqual(8);
			expect(step.caption.split(/\s+/).length).toBeLessThanOrEqual(25);
			for (const id of step.principles)
				expect(designPrinciples.find((principle) => principle.id === id)).toBeDefined();
		}
	});

	for (const step of landscapeChapter.steps) {
		test(`enforces the stage policy for ${step.id}`, () => {
			expect(resolveView(step)).toEqual({
				view: step.id === 'step-4' ? 'plan' : 'terrain',
				display: 'normal'
			});
			for (const view of viewModes) {
				if (step.views.some((allowed) => allowed === view))
					expect(resolveView(step, { view }).view).toBe(view);
				else expect(() => resolveView(step, { view })).toThrow(RangeError);
			}
			for (const display of displayModes)
				expect(resolveView(step, { display }).display).toBe(display);
			for (const display of ['transparency', 'levels'])
				expect(() => resolveView(step, { display })).toThrow(RangeError);
		});
	}
});
