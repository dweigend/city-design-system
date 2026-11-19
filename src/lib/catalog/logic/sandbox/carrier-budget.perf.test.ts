// @ts-expect-error Bun supplies the test API.
import { expect, test } from 'bun:test';
import { cpuMilliseconds, warmMedian } from '../../../../../scripts/performance-sample';
import { probeWallConnections } from './carrier-diagonals';
import {
	singularCarrier,
	tenRoofStroke
} from '../../../../../scripts/test-fixtures/carrier-budget';

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

test('singular carrier repairs and ten-roof pointer moves fit one frame', () => {
	for (const groups of [5, 6]) {
		const { grid, cells, parts } = singularCarrier(groups);
		fitsOneFrame(groups + ' groups', [() => probeWallConnections(grid, parts, cells)]);
	}
	fitsOneFrame('ten roofs', tenRoofStroke().moves);
});
