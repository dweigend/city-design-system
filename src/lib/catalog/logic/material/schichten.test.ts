import assert from 'node:assert/strict';
import { test } from 'node:test';
import { farbZielFaelle, farbZielSzene, formenSzene } from './schichten';
import { siedlungEntwurf } from './siedlung';
import { pickerStart } from './picker';

test('form focus keeps one form centered with the same ids and skins as the row', () => {
	const z = pickerStart();
	const reihe = formenSzene(z);
	const kuppel = formenSzene(z, 'kuppel');
	const ausReihe = reihe.filter((s) => s.id.startsWith('kuppel-'));
	assert.deepEqual(
		kuppel.map((s) => s.id),
		ausReihe.map((s) => s.id)
	);
	assert.deepEqual(
		kuppel.map((s) => s.rezept),
		ausReihe.map((s) => s.rezept)
	);
	// Alone, the dome sits at the origin; in the row it is offset along x only.
	const versatz = ausReihe[0].teil.lage[0] - kuppel[0].teil.lage[0];
	kuppel.forEach((s, i) => {
		assert.equal(s.teil.lage[0] + versatz, ausReihe[i].teil.lage[0]);
		assert.deepEqual(s.teil.mass, ausReihe[i].teil.mass);
	});
	assert.equal(kuppel[0].teil.lage[0], 0);
});

test('without focus the row still shows all four forms and leaves cores out', () => {
	const reihe = formenSzene(pickerStart());
	const formen = new Set(reihe.map((s) => s.id.split('-')[0]));
	assert.deepEqual([...formen], ['box', 'kuppel', 'turm', 'bestand']);
	assert.ok(reihe.every((s) => s.teil.rolle !== 'kern'));
});

test('color target repeats the first settlement house per case and keeps its fixed skins', () => {
	const haus = siedlungEntwurf(farbZielFaelle[0].saat, 1);
	const szene = farbZielSzene();
	assert.equal(szene.length, haus.length * farbZielFaelle.length);
	farbZielFaelle.forEach((_, i) => {
		const teile = szene.slice(i * haus.length, (i + 1) * haus.length);
		assert.deepEqual(
			teile.map((s) => s.id),
			haus.map((p) => `c${i}-${p.id}`)
		);
		haus.forEach((p, j) => {
			if (p.haut) assert.equal(teile[j].ausfuehrung, p.haut.finish);
		});
	});
});

test('one flow lands on the glaze skin but on the entry of glass and brass', () => {
	const haus = siedlungEntwurf(farbZielFaelle[0].saat, 1);
	const szene = farbZielSzene();
	const token = (i: number, zone: string) => {
		const j = haus.findIndex((p) => p.zone === zone && !p.haut);
		return szene[i * haus.length + j].rezept.farbe.token;
	};
	const fluss = token(0, 'huelle');
	assert.notEqual(fluss, '--paper');
	assert.notEqual(token(1, 'huelle'), fluss);
	assert.equal(token(1, 'akzent'), fluss);
	assert.equal(token(2, 'akzent'), fluss);
	const natur = farbZielSzene(farbZielFaelle.map((f) => ({ ...f, farbe: 'natur' as const })));
	assert.ok(natur.every((s) => s.rezept.farbe.token !== fluss));
});
