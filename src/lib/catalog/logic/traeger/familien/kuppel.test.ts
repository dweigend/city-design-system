import { describe, it as test } from 'node:test';
import assert from 'node:assert/strict';
import { planen, pruefePlan, loopZustand, kantenId } from '../index';
import { kuppel } from './kuppel';
import type { TraegerPlan } from '../plan';
const EPS_M = 1e-8;
const shell = (p: TraegerPlan) => p.flaechen.filter((f) => f.rolle !== 'boden');
const topology = (p: TraegerPlan) => ({
	knoten: p.knoten.map((k) => k.id),
	kanten: p.kanten.map((k) => [k.id, k.a, k.b]),
	flaechen: p.flaechen.map((f) => [f.id, f.knoten]),
	zellen: p.zellen.map((z) => [z.id, z.flaechen])
});
function classes(p: TraegerPlan) {
	const nodes = new Map(p.knoten.map((k) => [k.id, k.p]));
	return new Set(
		p.kanten.map((e) => {
			const a = nodes.get(e.a),
				b = nodes.get(e.b);
			if (!a || !b) throw new Error('Invalid incidence');
			return Math.round(Math.hypot(...a.map((x, i) => x - b[i])) / EPS_M);
		})
	).size;
}
describe('Fuller and Goldberg: executable examples', () => {
	for (const frequenz of [2, 3, 4])
		test(`frequency ${frequenz}: closed sphere and real length classes`, () => {
			const p = planen('kuppel', { frequenz, phase: 2 });
			assert.deepEqual(pruefePlan(p), []);
			assert.equal(p.knoten.length, 10 * frequenz ** 2 + 2);
			assert.equal(shell(p).length, 20 * frequenz ** 2);
			assert.equal(p.knoten.length - p.kanten.length + p.flaechen.length, 2);
			if (frequenz < 4) assert.equal(classes(p), frequenz);
		});
	for (const frequenz of [2, 3, 4])
		test(`base ${frequenz}: planar, true to the sphere, closed, manifold`, () => {
			const p = planen('kuppel', { frequenz });
			assert.deepEqual(pruefePlan(p), []);
			const ring = p.knoten.filter((k) => k.rolle === 'lager');
			assert.ok(ring.length > 5);
			ring.forEach((k) => assert.equal(k.p[2], 0));
			const top = Math.max(...p.knoten.map((k) => k.p[2]));
			p.knoten
				.filter((k) => k.rolle !== 'lager')
				.forEach((k) =>
					assert.ok(Math.abs(Math.hypot(k.p[0], k.p[1], k.p[2] - (top - 12)) - 12) < EPS_M)
				);
			assert.equal(p.knoten.length - p.kanten.length + shell(p).length, 1);
			assert.equal(p.knoten.length - p.kanten.length + p.flaechen.length, 2);
			const incidence = new Map<string, number>();
			for (const f of shell(p))
				for (let i = 0; i < f.knoten.length; i++) {
					const id = kantenId(f.knoten[i], f.knoten[(i + 1) % f.knoten.length]);
					incidence.set(id, (incidence.get(id) ?? 0) + 1);
				}
			assert.equal(Math.max(...incidence.values()), 2);
		});
	for (const frequenz of [2, 3, 4])
		test(`Goldberg ${frequenz}: twelve full or six uncut pentagons`, () => {
			const full = planen('kuppel', { frequenz, haut: 1, phase: 2 });
			assert.deepEqual(pruefePlan(full), []);
			assert.equal(shell(full).filter((f) => f.knoten.length === 5).length, 12);
			assert.equal(
				shell(full).every((f) => [5, 6].includes(f.knoten.length)),
				true
			);
			const dome = planen('kuppel', { frequenz, haut: 1 });
			assert.deepEqual(pruefePlan(dome), []);
			assert.equal(
				shell(dome).filter(
					(f) =>
						f.id.includes(':v:') &&
						f.knoten.length === 5 &&
						f.knoten.every((id) => !id.includes(':schnitt:'))
				).length,
				6
			);
		});
	test('frequency three: a planar cut adds three lengths and five quads', () => {
		const p = planen('kuppel');
		assert.equal(classes(p), 6);
		assert.equal(shell(p).filter((f) => f.knoten.length === 4).length, 5);
	});
	test('glass share: neutral skin transparent or closed, use panels stay', () => {
		assert.ok(
			shell(planen('kuppel', { glas: 1 })).filter((f) => f.rolle === 'glas').length >=
				0.85 * shell(planen('kuppel', { glas: 1 })).length
		);
		assert.ok(shell(planen('kuppel', { glas: 0 })).every((f) => f.rolle === 'paneel'));
	});
	test('deterministic; continuous parameters keep identity and incidence', () => {
		for (const haut of [0, 1])
			for (const phase of [0, 1, 2, 3]) {
				const base = planen('kuppel', { haut, phase });
				assert.deepEqual(base, planen('kuppel', { haut, phase }));
				for (const t of [0, 0.25, 0.5, 0.75, 1]) {
					const p = planen('kuppel', { haut, phase, radius: 9 + 6 * t, glas: t, kugel: t });
					assert.deepEqual(topology(p), topology(base));
					assert.deepEqual(p.kanten, base.kanten);
					assert.deepEqual(pruefePlan(p), []);
				}
			}
	});
	test('loop: icosahedron → subdivide → sphere → base', () => {
		assert.deepEqual(
			kuppel.loop.map((s) => s.name),
			['Icosahedron', 'Subdivide', 'Sphere', 'Base']
		);
		for (const seconds of [0, 3.9, 4, 7.9, 8, 11.9, 12, 15.9]) {
			const s = loopZustand(kuppel, seconds);
			assert.deepEqual(pruefePlan(planen('kuppel', s.werte)), []);
		}
		assert.equal(planen('kuppel', { phase: 0 }).flaechen.length, 20);
	});
});

test('the icosahedron stays pure with every skin; subdividing stays planar, garden and height flows are explicit', () => {
	for (const haut of [0, 1]) {
		const p = planen('kuppel', { phase: 0, haut });
		assert.equal(p.knoten.length, 12);
		assert.equal(p.kanten.length, 30);
		assert.equal(p.flaechen.length, 20);
		assert.equal(Math.min(...p.knoten.map((k) => k.p[2])), 0);
		const flat = planen('kuppel', { phase: 1, kugel: 0, haut });
		assert.equal(flat.flaechen.length, 180);
		// Barycentric subdivision stays inside the original twenty planar faces.
		const ico = planen('kuppel', { phase: 0 }),
			nodes = new Map(ico.knoten.map((k) => [k.id, k.p]));
		const planes = ico.flaechen.map((f) => {
			const [a, b, c] = f.knoten.map((id) => nodes.get(id) ?? [NaN, NaN, NaN]);
			const u = b.map((v, i) => v - a[i]),
				v = c.map((v, i) => v - a[i]);
			return {
				a,
				n: [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
			};
		});
		for (const k of flat.knoten)
			assert.ok(
				planes.some(
					({ a, n }) => Math.abs(n.reduce((s, v, i) => s + v * (k.p[i] - a[i]), 0)) < 1e-7
				)
			);
	}
	const p = planen('kuppel');
	assert.equal(p.zellen[0].nutzung, 'garten');
	const occupied = Object.entries(p.belegung).filter(([, v]) => v !== 'leer');
	assert.ok(occupied.length <= shell(p).length * 0.12);
	assert.deepEqual(new Set(occupied.map(([, v]) => v)), new Set(['food', 'energy']));
	for (const id of ['kugel', 'phase'])
		assert.equal(kuppel.parameter.find((p) => p.id === id)?.verborgen, true);
});
