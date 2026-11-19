// @ts-expect-error Bun supplies the test API.
import { expect, test } from 'bun:test';
import { cpuMilliseconds, warmMedian } from '../../../../../../scripts/performance-sample';
import { pal } from '../../../../../../scripts/test-fixtures/formlabor';
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
