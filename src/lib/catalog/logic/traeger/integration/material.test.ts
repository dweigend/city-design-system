import { describe, it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import { bauweisen, tragwerkStufen } from '../../../data/materialTraeger';
import { pruefePlan } from '../index';
import { materialModell, materialPlan, naehe } from './material';

const stufen = tragwerkStufen.map((s) => s.id);

describe('Material per construction type – public examples', () => {
	test('every construction type returns a valid plan and a complete bill of materials', () => {
		for (const b of bauweisen) {
			const plan = materialPlan(b.id, 42);
			assert.deepEqual(pruefePlan(plan), []);
			const m = materialModell(plan, 'nah');
			assert.deepEqual(m, materialModell(materialPlan(b.id, 42), 'nah'));
			const staebe = m.staebe.reduce((n, g) => n + g.strecken.length, 0);
			assert.equal(
				staebe + m.linien.length,
				plan.kanten.length,
				`${b.id}: every edge is a strut or a hairline`
			);
			assert.ok(m.flaechen.length > 0 && staebe > 0, b.id);
		}
	});

	test('gridshell: wooden laths, membrane above; dome: metal with hubs and glass', () => {
		const schale = materialModell(materialPlan('gitterschale'), 'nah');
		assert.deepEqual(
			schale.staebe.map((g) => [g.id, g.rezept.familie, g.radiusM]),
			[['rippe', 'holz', 0.07]]
		);
		assert.ok(schale.flaechen.every((g) => g.rezept.familie === 'membran'));
		assert.equal(schale.naben, null);
		const plan = materialPlan('gitterschale');
		const knoten = plan.knoten.find((n) => n.p.every((v, i) => v === schale.nah[i]));
		assert.ok(knoten);
		assert.ok(plan.kanten.filter((k) => k.a === knoten.id || k.b === knoten.id).length >= 4);
		assert.ok(plan.flaechen.filter((f) => f.knoten.includes(knoten.id)).length >= 4);
		const kuppel = materialModell(materialPlan('kuppel'), 'nah');
		assert.equal(kuppel.naben?.rezept.familie, 'metall');
		assert.ok(kuppel.flaechen.some((g) => g.rezept.familie === 'glas'));
	});

	test('the frame stays without a flow; only the occupancy carries color, at most three flows', () => {
		for (const b of bauweisen) {
			const m = materialModell(materialPlan(b.id, 7), 'nah');
			for (const g of [...m.staebe, ...(m.naben ? [m.naben] : [])])
				assert.equal(g.rezept.farbe.token, '--paper', b.id);
			const stroeme = new Set(
				m.flaechen.map((g) => g.id.split(':')[2]).filter((s) => s !== 'neutral')
			);
			assert.ok(stroeme.size <= 3, b.id);
			// Glass stays colorless: occupied glass faces are plastic.
			for (const g of m.flaechen)
				if (g.rezept.familie === 'glas') assert.equal(g.id.split(':')[2], 'neutral');
		}
	});

	test('the level shortens recipes without changing the bill of materials; ghost affects only the envelope', () => {
		const plan = materialPlan('kuppel');
		const nah = materialModell(plan, 'nah');
		for (const stufe of stufen) {
			const m = materialModell(plan, stufe);
			assert.deepEqual(
				m.flaechen.map((g) => [g.id, g.ringe]),
				nah.flaechen.map((g) => [g.id, g.ringe])
			);
			assert.deepEqual(
				m.staebe.map((g) => g.strecken),
				nah.staebe.map((g) => g.strecken)
			);
		}
		const linie = materialModell(plan, 'linie');
		assert.ok(linie.flaechen.every((g) => g.rezept.farbe.token === '--paper'));
		const geist = materialModell(plan, 'geist');
		assert.deepEqual(geist.staebe, nah.staebe);
		const glas = (m: typeof nah) => m.flaechen.find((g) => g.id.startsWith('glas'))?.rezept;
		assert.ok(glas(nah));
		assert.notDeepEqual(glas(geist), glas(nah));
		const boden = (m: typeof nah) => m.flaechen.find((g) => g.id.startsWith('boden'))?.rezept;
		assert.ok(boden(nah));
		assert.deepEqual(boden(geist), boden(nah));
	});

	test('the view moves continuously: close at the node, far for the whole, back across the seam', () => {
		assert.equal(naehe(stufen, 0, 1), 1);
		assert.equal(naehe(stufen, 2, 1), 0);
		assert.equal(naehe(stufen, 1, 0), naehe(stufen, 0, 1));
		assert.equal(naehe(stufen, 0, 0), naehe(stufen, 4, 1));
		assert.equal(naehe(stufen, 5, 0.2), naehe(stufen, 0, 0.2));
		const mitte = naehe(stufen, 1, 0.1);
		assert.ok(mitte < 1 && mitte > 0.5);
		assert.throws(() => naehe([], 0, 0), RangeError);
	});
});
