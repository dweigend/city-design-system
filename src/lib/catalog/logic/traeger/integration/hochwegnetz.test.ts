import { describe, it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import { pruefePlan } from '../index';
import { SPANNWEITE } from '../../parametrik/welt/wege';
import {
	HOCHWEG_M,
	STEG_BREITE_M,
	netzBei,
	quartierBei,
	tragwerkQuartier,
	wegePlan
} from './hochwegnetz';

describe('Structures as nodes of the elevated walkway network – public examples', () => {
	test('the same seed yields the same district, five families once each', () => {
		const a = tragwerkQuartier(42);
		assert.deepEqual(a, tragwerkQuartier(42));
		assert.deepEqual(a.plaene.map((p) => p.familie).sort(), [
			'faltwerk',
			'gitterschale',
			'kuppel',
			'raumfachwerk',
			'wabe'
		]);
		for (const p of a.plaene) assert.deepEqual(pruefePlan(p.plan), []);
	});

	test('every structure offers the elevated walkway level a surface or a chord at 8 m', () => {
		for (const p of tragwerkQuartier(7).plaene) {
			const hoehen = p.plan.knoten.map((n) => n.p[2] + p.lage.versatz[2]);
			assert.ok(
				hoehen.some((z) => Math.abs(z - HOCHWEG_M) < 1e-6),
				p.familie
			);
		}
	});

	test('the network is connected; only the path inside the space frame exceeds the span', () => {
		const q = tragwerkQuartier(42);
		const eltern = q.knoten.map((_, i) => i);
		const wurzel = (i: number): number => (eltern[i] === i ? i : (eltern[i] = wurzel(eltern[i])));
		for (const e of q.kanten) {
			eltern[wurzel(e.a)] = wurzel(e.b);
			if (e.traeger) assert.ok(e.laenge > SPANNWEITE);
			else assert.ok(e.laenge <= SPANNWEITE, e.target);
		}
		assert.equal(new Set(q.knoten.map((_, i) => wurzel(i))).size, 1);
		assert.equal(q.kanten.filter((e) => e.traeger).length, 1);
		const schleifen = q.kanten.filter((e) => e.schleife).length;
		assert.ok(schleifen >= 1 && schleifen <= 2);
		assert.equal(new Set(q.kanten.map((e) => e.target)).size, q.kanten.length);
	});

	test('the full path network is a valid plan at 8 m, occupied by people alone', () => {
		const q = tragwerkQuartier(42);
		const plan = wegePlan(q.knoten, q.kanten, 42);
		assert.deepEqual(pruefePlan(plan), []);
		assert.ok(plan.knoten.every((n) => n.p[2] === HOCHWEG_M));
		assert.deepEqual([...new Set(Object.values(plan.belegung))], ['people']);
		for (const f of plan.flaechen) {
			const [a, , , d] = f.knoten.map((id) => plan.knoten.find((n) => n.id === id)?.p ?? [0, 0, 0]);
			assert.ok(Math.abs(Math.hypot(a[0] - d[0], a[1] - d[1]) - STEG_BREITE_M) < 1e-9);
		}
	});

	test('growth only moves nodes: topology and seed of the district stay the same', () => {
		const q = tragwerkQuartier(42);
		const topologie = (schritt: number) => {
			const p = quartierBei(q, schritt).plaene[5].plan;
			return [p.knoten.map((n) => n.id), p.kanten, p.flaechen, p.belegung];
		};
		assert.deepEqual(topologie(0), topologie(q.kanten.length));
		assert.deepEqual(topologie(2.4), topologie(q.kanten.length));
		const halb = netzBei(q.kanten, 2.5);
		assert.deepEqual(
			halb.slice(0, 4).map((e) => e.anteil),
			[1, 1, 0.5, 0]
		);
		assert.throws(() => netzBei(q.kanten, Number.NaN), RangeError);
		// Another seed: same building plots and paths, a different occupancy.
		const b = tragwerkQuartier(43);
		assert.deepEqual(b.kanten, q.kanten);
		assert.notDeepEqual(
			b.plaene.map((p) => p.plan.belegung),
			q.plaene.map((p) => p.plan.belegung)
		);
	});
});
