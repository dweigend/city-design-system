import { expect, test } from 'bun:test';
import { cpuMilliseconds, warmMedian } from '../../fixtures/performance-sample.fixture.test';
import { tenRoofStroke } from './fixtures/carrier-budget.fixture.test';

function fitsOneFrame(label: string, moves: (() => unknown)[]) {
	for (let i = 0; i < 12; i++) for (const move of moves) move();
	// Keep the maximum over all moves in each measured batch.
	const max = warmMedian(() => {
		const times = Array.from({ length: 30 }, () => moves.map(cpuMilliseconds)).flat();
		const peak = Math.max(...times);
		expect(peak, label).toBeLessThan(16);
		return peak;
	}, 0);
	console.info(label, 'median of batch maxima:', max.toFixed(2), 'ms CPU');
}

test('ten-roof pointer moves fit one frame', () => {
	fitsOneFrame('ten roofs', tenRoofStroke().moves);
});
