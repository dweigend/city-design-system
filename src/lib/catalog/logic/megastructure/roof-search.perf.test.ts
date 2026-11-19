import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { cpuMilliseconds, warmMedian } from '../../fixtures/performance-sample.fixture.test';
import { connectedRow, reviewRow } from './fixtures/roof-search.fixture.test';
import { planRoofFrame } from './index';

test('conflicting and connected roof rows each plan in under 50 ms', () => {
	for (const n of [13, 30]) {
		for (const makeRow of [reviewRow, connectedRow]) {
			const roofs = makeRow(n);
			const ms = warmMedian(() => cpuMilliseconds(() => planRoofFrame(roofs, { maxSpan: 7 })), 2);
			const label = `${makeRow.name} (${n} roofs): ${ms.toFixed(2)} ms CPU`;
			console.info(label);
			assert.ok(ms < 50, label);
		}
	}
});
