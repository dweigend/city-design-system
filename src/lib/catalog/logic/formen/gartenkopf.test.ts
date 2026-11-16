import { it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import { turm, startWahl, bisPhase } from './turm';
import { testCells } from '../parametrik/formen/zellen';
test('tube capsule → path rejects a garden without a planar bearing', () => {
	const t = turm(
		{ ...startWahl, stapel: { familie: 'kapsel-roehre' } },
		{ polygon: testCells.square.polygon }
	);
	assert.equal(t.kopfGueltig, false);
	assert.equal(
		bisPhase(t, 'weg').some((p) => p.id.startsWith('kopf:')),
		false
	);
	assert.equal(
		bisPhase(t, 'weg').some((p) => p.id.startsWith('stapel:')),
		true
	);
});
