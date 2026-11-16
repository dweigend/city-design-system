import { it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import { analysiere, type StabStatik } from '../haus-tragwerk';
import { readFileSync } from 'node:fs';
import { hausParameter } from '../haus-tragwerk';
import {
	VORBERECHNETE_AUFTRAEGE,
	hausSchluessel,
	mitBelegung,
	rechneHaus,
	vorberechnet
} from './hausAuftrag';

test('precomputation: the stored result is byte-identical to a fresh computation', () => {
	for (const auftrag of VORBERECHNETE_AUFTRAEGE) {
		const frisch = rechneHaus(auftrag);
		assert.equal(JSON.stringify(vorberechnet(auftrag)), JSON.stringify(frisch));
		// Serializable both ways: what a worker posts is what the caller gets.
		assert.deepEqual(structuredClone(frisch), frisch);
	}
	// All three steps of the first visit are stored.
	assert.deepEqual(VORBERECHNETE_AUFTRAEGE.map((a) => a.stufe).sort(), [
		'abtrag',
		'block',
		'kraefte'
	]);
	assert.equal(vorberechnet({ familie: 'raumfachwerk', saat: 7, stufe: 'abtrag' }), undefined);
	const a = { familie: 'raumfachwerk', saat: 42, stufe: 'abtrag' } as const;
	assert.equal(
		hausSchluessel(a),
		hausSchluessel({ stufe: 'abtrag', saat: 42, familie: 'raumfachwerk' })
	);
	assert.notEqual(hausSchluessel(a), hausSchluessel({ ...a, stufe: 'kraefte' }));
});

test('key: the same input does not recompute, a different load does', () => {
	const a = { familie: 'raumfachwerk', saat: 42, stufe: 'abtrag' } as const;
	// The key follows what the seed decides. A seed that draws the same house shares the result.
	const zwilling = [...Array(2000).keys()].find(
		(saat) =>
			saat !== 42 && JSON.stringify(hausParameter(saat)) === JSON.stringify(hausParameter(42))
	);
	assert.ok(zwilling !== undefined);
	assert.equal(hausSchluessel({ ...a, saat: zwilling }), hausSchluessel(a));
	assert.equal(vorberechnet({ ...a, saat: zwilling })?.haus.saat, zwilling);
	const zwillingHaus = rechneHaus({ ...a, saat: zwilling }).haus;
	assert.deepEqual(zwillingHaus.statik, rechneHaus(a).haus.statik);
	assert.notEqual(hausSchluessel({ ...a, saat: 7 }), hausSchluessel(a));
	// The inhabited house is the default occupancy; any other occupancy is another job.
	const bewohnt = { raum: 'people', garten: true } as const;
	assert.equal(hausSchluessel({ ...a, belegung: bewohnt }), hausSchluessel(a));
	const andere = [
		{ raum: 'material', garten: true },
		{ raum: 'people', garten: false },
		{ raum: 'leer', garten: false }
	] as const;
	const schluessel = new Set([
		hausSchluessel(a),
		...andere.map((b) => hausSchluessel({ ...a, belegung: b }))
	]);
	assert.equal(schluessel.size, 4);
	// The job returns the house in the asked occupancy with forces that belong to it.
	const basis = rechneHaus(a).haus;
	for (const belegung of andere) {
		const { haus } = rechneHaus({ ...a, belegung });
		assert.deepEqual(haus.statik?.belegung, belegung);
		assert.equal(haus.einbauten.length, belegung.raum === 'leer' ? 0 : belegung.garten ? 2 : 1);
		assert.deepEqual(haus.traeger.kanten, basis.traeger.kanten);
		assert.deepEqual(structuredClone(haus), haus);
	}
	// Unchanged occupancy: the same house, nothing is computed.
	assert.equal(mitBelegung(basis, bewohnt), basis);
});

test('analysis: fixed classes, tension and compression on separate sides, colors only as tokens', () => {
	const { haus } = rechneHaus(VORBERECHNETE_AUFTRAEGE[0]);
	const statik = haus.statik;
	assert.ok(statik);
	const css = readFileSync(new URL('../../../../app.css', import.meta.url), 'utf8');
	for (const art of ['kraft', 'ausnutzung', 'verformung'] as const) {
		const a = analysiere(haus, art);
		assert.ok(a);
		assert.ok(a.klassen.length >= 5 && a.klassen.length <= 7);
		assert.equal(a.strecken.length, haus.traeger.kanten.length + statik.haenger.length);
		for (const [i, k] of a.klassen.entries()) {
			assert.ok(k.bis > k.von);
			if (i) assert.equal(k.von, a.klassen[i - 1].bis);
			// Color values live in app.css only; the class carries a token name.
			assert.ok(css.includes(`${k.token}:`), k.token);
		}
		assert.equal(a.ueberhoehung > 1, art === 'verformung');
		// Fixed limits in every view: seeds stay comparable.
		assert.equal(a.automatisch, false);
		// The floor ribs show where the load enters the hangers.
		assert.equal(a.rippen.length, statik.rippen.length);
	}
	// Fixed, symmetric force classes outside the flow colors: violet pushes, teal pulls.
	const kraft = analysiere(haus, 'kraft');
	assert.ok(kraft);
	assert.deepEqual(
		kraft.klassen.map((k) => -k.bis),
		[...kraft.klassen].reverse().map((k) => k.von)
	);
	for (const s of kraft.strecken) {
		const stab: StabStatik | undefined =
			statik.staebe[s.id] ?? statik.haenger.find((h) => h.id === s.id);
		assert.ok(stab);
		const token: string = kraft.klassen[s.klasse].token;
		const kraftN = Math.max(stab.zugN, stab.druckN);
		if (kraftN < 25e3) assert.equal(token, '--ana-null');
		else assert.ok(token.startsWith(stab.druckN > stab.zugN ? '--ana-druck' : '--ana-zug'));
		assert.equal(s.druck, stab.druck);
	}
	// Utilization: five steps up to the limit, anything above is the warning class.
	const ausnutzung = analysiere(haus, 'ausnutzung');
	assert.ok(ausnutzung);
	assert.equal(ausnutzung.klassen[4].bis, 1);
	assert.equal(ausnutzung.klassen[5].token, '--cat-hazard');
	assert.ok(ausnutzung.strecken.every((s) => s.klasse <= 4));
});
