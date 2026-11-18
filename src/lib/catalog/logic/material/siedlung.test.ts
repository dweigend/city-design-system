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
			const halfWidth = ({ teil }: (typeof house)[number]) =>
				teil.art === 'quader' ? teil.mass[0] / 2 : teil.mass[0];
			const left = Math.min(...house.map((p) => p.teil.lage[0] - halfWidth(p)));
			assert.ok(left - right >= 1.2);
			right = Math.max(...house.map((p) => p.teil.lage[0] + halfWidth(p)));
		}
	}
});

test('the first settlement reads as a dome, a lobed tower and a gridshell', () => {
	const ids = siedlungEntwurf(1).map((p) => p.id);
	for (const id of ['h0-dome-panels', 'h1-tower-skin', 'h1-tower-seams', 'h2-shell-panels']) {
		assert.ok(ids.includes(id), id);
	}
});

test('every house combines the picked surface with multiple permanent finishes', () => {
	const a = siedlungEntwurf(1);
	const zonen = { huelle: graphit, kern: graphit, sockel: beton, akzent: beton };
	const before = bekleide(a, zonen);
	const after = bekleide(a, { ...zonen, huelle: beton });
	for (const i of [0, 1, 2]) {
		const house = before.filter((part) => part.id.startsWith(`h${i}-`));
		assert.ok(new Set(house.map((part) => part.ausfuehrung)).size >= 4);
		assert.ok(
			house.some((part) => after.find((b) => b.id === part.id)?.ausfuehrung !== part.ausfuehrung)
		);
	}
});

test('the visible dome and gridshell retain both the roof panels and their separate frame', () => {
	for (const name of ['h0-dome', 'h2-shell']) {
		const house = siedlungEntwurf(2);
		assert.equal(house.find((p) => p.id === `${name}-panels`)?.zone, 'huelle');
		assert.equal(house.find((p) => p.id === `${name}-frame`)?.zone, 'kern');
	}
});
