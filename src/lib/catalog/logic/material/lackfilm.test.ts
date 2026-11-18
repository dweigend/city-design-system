import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lackfilm } from './lackfilm';

test('film snapshots are deterministic and detached', () => {
	const a = lackfilm(12);
	const b = lackfilm(12);
	assert.deepEqual(a, b);
	assert.notEqual(a.tiefeM, b.tiefeM);
	assert.notDeepEqual(a.tiefeM, lackfilm(13).tiefeM);
});

test('redistribution conserves the supplied coating volume', () => {
	const basis = lackfilm(23, 0);
	const fertig = lackfilm(23);
	const summe = (a: Float64Array) => a.reduce((s, x) => s + x, 0);
	assert.ok(Math.abs(summe(basis.tiefeM) - summe(fertig.tiefeM)) < 1e-8);
	assert.ok(fertig.tiefeM.every((h) => Number.isFinite(h) && h >= 0));
});

test('gravity transports the film down from the top', () => {
	const basis = lackfilm(57, 0);
	const fertig = lackfilm(57);
	assert.ok(fertig.tiefeM.slice(fertig.spalten * 5).some((h) => h > 0.007));
	assert.ok(basis.tiefeM.slice(basis.spalten * 5).every((h) => h === 0));
});

test('the settled front varies around the perimeter without wetting the base', () => {
	const film = lackfilm(57);
	const front = [...film.front];
	assert.ok(Math.max(...front) - Math.min(...front) > 0.18);
	assert.ok(Math.max(...front) <= 0.85);
	assert.ok(Math.min(...front) >= 0.07);
});
