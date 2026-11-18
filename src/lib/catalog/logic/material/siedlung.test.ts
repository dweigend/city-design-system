import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beton, graphit } from './hausBausteine';
import { bekleide, siedlungEntwurf } from './siedlung';

test('the seed fixes geometry, IDs and order independently of dressing', () => {
	const a = siedlungEntwurf(1);
	assert.deepEqual(a, siedlungEntwurf(1));
	assert.equal(new Set(a.map((p) => p.id)).size, a.length);
	assert.notDeepEqual(
		a.map((p) => p.teil),
		siedlungEntwurf(2).map((p) => p.teil)
	);
	const dressed = bekleide(a, { huelle: graphit, kern: graphit, sockel: beton, akzent: beton });
	dressed[0].teil.lage[2] = 99;
	assert.equal(a[0].teil.lage[2], 0);
});

test('houses stand above ground with separated bounds and all four finish zones', () => {
	for (const seed of [0, 1, 32, 101, 65535]) {
		const parts = siedlungEntwurf(seed, 6);
		let right = -Infinity;
		for (let i = 0; i < 6; i++) {
			const house = parts.filter((p) => p.id.startsWith(`h${i}-`));
			assert.deepEqual(
				new Set(house.map((p) => p.zone)),
				new Set(['huelle', 'akzent', 'sockel', 'kern'])
			);
			assert.equal(Math.min(...house.map((p) => p.teil.lage[2])), 0);
			const left = Math.min(...house.map(({ teil }) => teil.lage[0] - teil.mass[0] / 2));
			assert.ok(left - right >= 1.2);
			right = Math.max(...house.map(({ teil }) => teil.lage[0] + teil.mass[0] / 2));
		}
	}
});
