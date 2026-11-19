import { expect, test } from 'bun:test';
import { cpuMilliseconds, warmMedian } from '../../../fixtures/performance-sample.fixture.test';
import { pal } from './fixtures/formlabor.fixture.test';
import { leere, strecke, turm, turmpuffer } from './index';

test('the plan stays within the budget of one frame', () => {
	const p = turmpuffer();
	const build = (u: number) => {
		leere(p);
		turm(strecke(u), 19, pal, p);
	};
	for (let i = 0; i < 20; i++) build(i * 0.3);
	const ms = warmMedian(
		() =>
			cpuMilliseconds(() => {
				for (let i = 0; i < 100; i++) build((i * 0.07) % 7);
			}) / 100,
		0
	);
	console.info('Form-lab frame median:', ms.toFixed(2), 'ms CPU');
	expect(ms).toBeLessThan(4);
});
