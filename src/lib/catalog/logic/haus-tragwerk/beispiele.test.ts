import { it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
	neuBauen,
	einsetzen,
	entfernen,
	nutzungSetzen,
	pruefeHaus,
	kandidaten,
	lichteBreite,
	rechteck,
	pruefeEinbau
} from './index';
import { hausKontext, stadtstueck } from '../traeger/ensemble';

test('E1′: hanging capsule across two bays, use changes without a carrier change', () => {
	const haus = neuBauen('raumfachwerk', 42, { felder: 4, tiefe: 3, lagen: 2 });
	const anschluss = kandidaten(haus)[0];
	const a = einsetzen(haus, anschluss.id, 'people');
	assert.equal(a.fehler, undefined);
	assert.equal(a.plan.einbauten[0].id, `${anschluss.elementId}/einbau`);
	assert.ok(anschluss.flaecheM2 >= 8);
	assert.ok(anschluss.hoeheM >= 2.4);
	assert.ok(anschluss.knoten.length >= 2);
	assert.ok(
		anschluss.z + anschluss.hoeheM <
			Math.min(...haus.traeger.knoten.filter((n) => n.rolle !== 'lager').map((n) => n.p[2]))
	);
	const b = nutzungSetzen(a.plan, a.plan.einbauten[0].id, 'material');
	assert.equal(b.plan.traeger, haus.traeger);
	assert.equal(JSON.stringify(b.plan.traeger), JSON.stringify(haus.traeger));
	assert.equal(b.plan.einbauten[0].id, a.plan.einbauten[0].id);
	assert.deepEqual(pruefeHaus(b.plan), []);
});
test('E2: honeycomb shares walls, reserves the shaft and protects the room under the garden', () => {
	let h = neuBauen('wabe', 42, { ringe: 2, lagen: 3, stufen: 1 });
	const a = kandidaten(h).filter((a) => a.art === 'raum');
	const left = a[0];
	const right = a.find(
		(b) => b.id !== left.id && b.wandIds.some((id) => left.wandIds.includes(id))
	);
	assert.ok(right);
	h = einsetzen(h, left.id, 'people').plan;
	h = einsetzen(h, right.id, 'material').plan;
	assert.equal(h.einbauten.length, 2);
	assert.equal(
		a.every((a) => !a.elementId.includes('q0r0')),
		true
	);
	const room = kandidaten(h).find(
		(a) => a.art === 'raum' && kandidaten(h).some((g) => g.traegt === `${a.elementId}/einbau`)
	);
	assert.ok(room);
	h = einsetzen(h, room.id, 'people').plan;
	const garden = kandidaten(h).find((a) => a.traegt === `${room.elementId}/einbau`);
	assert.ok(garden);
	h = einsetzen(h, garden.id, 'food').plan;
	const blocked = entfernen(h, `${room.elementId}/einbau`);
	assert.equal(blocked.fehler, 'abhaengig');
	assert.equal(blocked.plan, h);
	assert.deepEqual(pruefeHaus(h), []);
});
test('E3′: dome on existing stock, radius 12 fits, radius 9 rejects the room atomically', () => {
	for (const radius of [12, 9]) {
		const h = neuBauen('kuppel', 42, { radius });
		const r = einsetzen(h, kandidaten(h)[0].id, 'people');
		if (radius === 12) {
			assert.equal(r.fehler, undefined);
			assert.deepEqual(pruefeHaus(r.plan), []);
		} else {
			assert.equal(r.fehler, 'kollision');
			assert.equal(r.plan, h);
		}
		assert.equal(h.eingang.p[2], 8);
	}
});
test('E4: folded house, reject insufficient valley height', () => {
	for (const faltwinkel of [1, 0.05]) {
		const h = neuBauen('faltwerk', 42, {
			bahnen: 6,
			felder: 4,
			faltwinkel,
			...(faltwinkel === 0.05 ? { phase: 0, zuschnitt: 0 } : {})
		});
		const r = einsetzen(h, kandidaten(h)[0].id, 'people');
		if (faltwinkel === 1) {
			assert.equal(r.fehler, undefined);
			assert.deepEqual(pruefeHaus(r.plan), []);
		} else {
			assert.equal(r.fehler, 'anschluss-unpassend');
			assert.equal(r.plan, h);
		}
	}
});
test('E5: replacement and new build, candidate order and garden contact', () => {
	const h = neuBauen('raumfachwerk');
	const a = kandidaten(h)[0];
	const occupied = einsetzen(h, a.id, 'people').plan;
	assert.equal(entfernen(occupied, occupied.einbauten[0].id).plan.traeger, h.traeger);
	assert.deepEqual(neuBauen('wabe').einbauten, []);
	assert.deepEqual(kandidaten({ ...h, anschluesse: [...h.anschluesse].reverse() }), kandidaten(h));
	assert.equal(JSON.stringify(neuBauen('raumfachwerk')), JSON.stringify(h));
	assert.deepEqual(einsetzen(h, 'fremd', 'people'), { plan: h, fehler: 'anschluss-unpassend' });
	for (const id of ['wabe', 'faltwerk', 'kuppel', 'raumfachwerk'] as const) {
		const p = neuBauen(id);
		for (const n of p.traeger.knoten.filter((n) => n.rolle === 'lager')) assert.equal(n.p[2], 8);
	}
});

test('R2: 1-m strips rejected in every family; accepted rooms at least 2.4m wide', () => {
	for (const familie of ['raumfachwerk', 'wabe', 'faltwerk', 'kuppel'] as const) {
		const h = neuBauen(familie),
			a = kandidaten(h)[0];
		assert.ok(lichteBreite(a.polygon) >= 2.4 - 1e-9);
		assert.equal(
			pruefeEinbau(h, { ...a, polygon: rechteck(0, 0, 12, 1), flaecheM2: 12 }),
			'anschluss-unpassend'
		);
	}
});
test('R2: actual insertion order of two honeycomb rooms is byte invariant', () => {
	const h = neuBauen('wabe'),
		[a, b] = kandidaten(h).filter((a) => a.art === 'raum' && a.z === 8);
	const ab = einsetzen(einsetzen(h, a.id, 'people').plan, b.id, 'material');
	const ba = einsetzen(einsetzen(h, b.id, 'material').plan, a.id, 'people');
	assert.equal(ab.fehler, undefined);
	assert.equal(ba.fehler, undefined);
	assert.equal(ab.plan.einbauten.length, 2);
	assert.equal(JSON.stringify(ab.plan), JSON.stringify(ba.plan));
});
test('R2: real stock volumes, crowns and hanging capsule clearance', () => {
	for (const familie of ['raumfachwerk', 'wabe', 'faltwerk', 'kuppel'] as const) {
		const h = neuBauen(familie),
			c = hausKontext(h);
		const bodies = c.bestand.filter((p) => p.kind === 'box');
		assert.equal(bodies.length, familie === 'raumfachwerk' ? 2 : 1);
		for (const b of bodies) if (b.kind === 'box') assert.equal(b.size[2], 8);
		for (const n of h.traeger.knoten.filter((n) => n.rolle === 'lager')) {
			assert.equal(n.p[2], 8);
			assert.ok(
				c.wandachsen.some(([a, b]) => {
					const dx = b[0] - a[0],
						dy = b[1] - a[1],
						t = Math.max(
							0,
							Math.min(1, ((n.p[0] - a[0]) * dx + (n.p[1] - a[1]) * dy) / (dx * dx + dy * dy))
						);
					return Math.hypot(n.p[0] - a[0] - t * dx, n.p[1] - a[1] - t * dy) <= 0.3;
				})
			);
		}
		if (familie === 'raumfachwerk') {
			const a = kandidaten(h)[0],
				bottom = Math.min(
					...h.traeger.knoten.filter((n) => n.rolle !== 'lager').map((n) => n.p[2])
				);
			assert.ok(bottom - a.z - a.hoeheM <= 1);
			for (const b of bodies)
				if (b.kind === 'box')
					assert.ok(a.polygon.every(([x]) => x > b.position[0] + b.size[0] || x < b.position[0]));
			assert.equal(
				new Set(h.traeger.knoten.filter((n) => n.rolle !== 'lager').map((n) => n.p[2])).size,
				2
			);
		}
	}
	const stadt = stadtstueck();
	assert.equal(stadt.plaene[1].lage.versatz[2], 0);
});

test('R2: four-strip folded roof cannot hold a 3.5m bay; reject atomically', () => {
	const h = neuBauen('faltwerk', 42, { bahnen: 4, felder: 4 });
	const result = einsetzen(h, kandidaten(h)[0].id, 'people');
	assert.equal(result.fehler, 'anschluss-unpassend');
	assert.equal(result.plan, h);
	const standard = kandidaten(neuBauen('faltwerk'))[0];
	assert.equal(standard.hoeheM, 3.5);
});
