import { expect, test } from 'bun:test';
import { designPrinciples } from '../design-principles';
import { resolveView } from '../../logic/view-modes';
import { chapters, type ChapterStep } from './index';

test('lists the ten bible chapters in order, each with all of its outlined steps', () => {
	expect(chapters.map(({ number }) => number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 9.1]);
	expect(chapters.map(({ steps }) => steps.length)).toEqual([5, 9, 7, 5, 9, 8, 8, 11, 6, 8]);
	expect(new Set(chapters.map(({ slug }) => slug)).size).toBe(chapters.length);
});

for (const chapter of chapters) {
	test(`${chapter.title} has stable step IDs, supported views and registered principles`, () => {
		const offset = chapter.number === 9 ? 1 : 0;
		expect(chapter.steps.map(({ id }) => id)).toEqual(
			chapter.steps.map<ChapterStep['id']>((_, index) => `step-${index + offset}`)
		);
		for (const step of chapter.steps) {
			expect(resolveView(step).view).toBe(step.view);
			expect(step.caption.split(/\s+/).length).toBeLessThanOrEqual(25);
			const built =
				(chapter.number === 1 && ['step-0', 'step-1', 'step-2'].includes(step.id)) ||
				(chapter.number === 5 && step.id === 'step-8');
			if (!built) {
				expect(step.details.text).toBe('Status: placeholder · demo follows');
				expect(step.control.kind).toBe('view');
			}
			for (const id of step.principles)
				expect(designPrinciples.some((principle) => principle.id === id)).toBe(true);
		}
	});
}
