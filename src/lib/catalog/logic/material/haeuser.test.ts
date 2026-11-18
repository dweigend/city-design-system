import assert from 'node:assert/strict';
import { test } from 'node:test';
import { materialHausWahl } from '../../data/materialHaeuser';
import { materialHaus } from './haeuser';

test('the timber house has a raised cladding volume and open window walls on both faces', () => {
	const parts = materialHaus('timber');
	assert.equal(parts.filter((p) => p.teil.profil?.art === 'fassade').length, 2);
	assert.ok(parts.some((p) => p.teil.lage[2] >= 3 && p.rezept.familie === 'holz'));
});

test('the glass pavilion has thin frames, clear glass on three sides and a red core', () => {
	const parts = materialHaus('glazed');
	assert.equal(parts.filter((p) => p.ausfuehrung === 'glas-klar').length, 3);
	const frames = parts.filter((p) => p.id.includes('mullion') || p.id.includes('rail'));
	assert.ok(frames.length >= 10 && frames.every((p) => Math.min(...p.teil.mass) <= 0.05));
	assert.ok(parts.some((p) => p.id === 'interior-core' && p.ausfuehrung === 'metall-signalrot'));
});

test('the aggregate tower is three stacked boxes, each smaller, with a door notch at the base', () => {
	const parts = materialHaus('aggregate');
	const roofs = parts.filter((p) => p.id.endsWith('-roof'));
	assert.equal(roofs.length, 3);
	assert.ok(roofs[1].teil.mass[0] < roofs[0].teil.mass[0]);
	assert.ok(roofs[2].teil.mass[0] < roofs[1].teil.mass[0]);
	assert.ok(parts.some((p) => p.id === 'lower-front-lintel'));
	assert.ok(parts.every((p) => p.rezept.kante === null));
});

test('the painted tower pairs a fixed substrate with a raised lackfilm coat', () => {
	const basis = materialHaus('painted');
	const coat = basis.find((p) => p.teil.profil?.art === 'lackfilm');
	assert.equal(coat?.ausfuehrung, 'kunststoff-guss');
	assert.ok(basis.some((p) => p.id === 'body-front-lintel'));
	assert.equal(materialHaus('veined')[1].ausfuehrung, 'beton-geadert');
});

test('switching material keeps all geometry, part identities, ordering and ground contact', () => {
	for (const { value } of materialHausWahl) {
		const basis = materialHaus(value);
		const other = materialHaus(value, true);
		assert.deepEqual(basis, materialHaus(value));
		assert.equal(new Set(basis.map((p) => p.id)).size, basis.length);
		assert.ok(basis.length < 40);
		assert.equal(Math.min(...basis.map((p) => p.teil.lage[2])), 0);
		assert.ok(!basis.some((p) => p.id === 'base'));
		assert.deepEqual(
			basis.map((p) => [p.id, p.teil]),
			other.map((p) => [p.id, p.teil])
		);
		assert.notDeepEqual(basis, other);
	}
});
