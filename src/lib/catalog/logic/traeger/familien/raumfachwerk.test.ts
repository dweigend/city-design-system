import { describe, it as test } from 'node:test';
import assert from 'node:assert/strict';
import { raumfachwerk } from './raumfachwerk';
import { pruefePlan, type TraegerPlan } from '../plan';
function nahe(actual: number, expected: number, digits: number) {
	assert.ok(Math.abs(actual - expected) < 10 ** -digits, `${actual} ≈ ${expected}`);
}
const A = 3.5 / Math.sqrt(2 / 3);
const H = 3.5;
const EPS_M = 1e-9 * A;
function vorhanden<T>(value: T | undefined): T {
	if (value === undefined) throw new Error('Missing test element');
	return value;
}
const defaults = Object.fromEntries(raumfachwerk.parameter.map((p) => [p.id, p.start]));
const plan = (werte: Record<string, number> = {}, saat = 42) =>
	raumfachwerk.planen({ ...defaults, ...werte }, saat);
const topology = (p: TraegerPlan) => [
	p.knoten.map((k) => [k.id, k.rolle]),
	p.kanten,
	p.flaechen.map((f) => [f.id, f.knoten]),
	p.zellen
];
describe('Octet: executable contract examples', () => {
	test('tetrahedron: four triangles and six struts of equal length', () => {
		const p = plan({ phase: 0 });
		assert.equal(p.knoten.length, 4);
		assert.equal(p.kanten.length, 6);
		assert.equal(p.zellen.length, 1);
		assert.equal(p.zellen[0].flaechen.length, 4);
		assert.deepEqual(pruefePlan(p), []);
	});
	test('octahedron connects through a shared triangular face', () => {
		const p = plan({ phase: 1 });
		assert.equal(p.zellen.length, 2);
		assert.equal(p.zellen[0].flaechen.filter((f) => p.zellen[1].flaechen.includes(f)).length, 1);
		assert.deepEqual(pruefePlan(p), []);
	});
	test('4 × 3 × 2: 32 tetrahedra and 14 octahedra in the rectangular window', () => {
		const p = plan();
		assert.equal(p.zellen.filter((z) => z.id.includes(':tet:')).length, 32);
		assert.equal(p.zellen.filter((z) => z.id.includes(':okt:')).length, 14);
		nahe(
			p.zellen.reduce((s, z) => s + z.volumenM3, 0),
			(32 * A ** 3) / (6 * Math.sqrt(2)) + (14 * A ** 3 * Math.sqrt(2)) / 3,
			8
		);
		assert.deepEqual(pruefePlan(p), []);
	});
	test('occupancy: octahedra only, horizontal floors, four bearings at z=0', () => {
		const p = plan({ belegung: 1 });
		assert.equal(p.knoten.filter((k) => k.rolle === 'lager').length, 4);
		assert.equal(
			p.knoten.filter((k) => k.rolle === 'lager').every((k) => k.p[2] === 0),
			true
		);
		const occupied = p.zellen.filter((z) => p.belegung[z.id] && p.belegung[z.id] !== 'leer');
		assert.equal(occupied.length, 14);
		assert.equal(
			occupied.every((z) => z.id.includes(':okt:')),
			true
		);
		assert.ok(occupied.length / p.zellen.length <= 0.4);
		for (const z of occupied) {
			const floor = vorhanden(
				p.flaechen.find((f) => z.flaechen.includes(f.id) && f.rolle === 'boden')
			);
			assert.notEqual(floor, undefined);
			assert.equal(z.nutzung, 'raum');
			assert.equal(
				z.flaechen.filter((id) => p.flaechen.find((f) => f.id === id)?.rolle === 'paneel').length,
				3
			);
			assert.equal(
				new Set(floor.knoten.map((id) => vorhanden(p.knoten.find((k) => k.id === id)).p[2])).size,
				1
			);
		}
	});
	test('all sizes: deterministic, closed cell envelopes, one strut length, valence twelve', () => {
		for (const felder of [3, 4, 6])
			for (const tiefe of [2, 3])
				for (const lagen of [1, 2, 3]) {
					const p = plan({ felder, tiefe, lagen });
					assert.deepEqual(p, plan({ felder, tiefe, lagen }));
					assert.deepEqual(pruefePlan(p), []);
					const nodes = new Map(p.knoten.map((k) => [k.id, k]));
					const valenz = new Map<string, number>();
					for (const e of p.kanten.filter((e) => e.rolle === 'stab')) {
						const a = vorhanden(nodes.get(e.a)).p,
							b = vorhanden(nodes.get(e.b)).p;
						assert.ok(Math.abs(Math.hypot(...a.map((x, i) => x - b[i])) - A) < EPS_M);
						for (const id of [e.a, e.b]) valenz.set(id, (valenz.get(id) ?? 0) + 1);
					}
					assert.ok(Math.max(...valenz.values()) <= (lagen === 1 ? 9 : 12));
					if (tiefe === 3 && lagen > 1) assert.equal(Math.max(...valenz.values()), 12);
					for (const n of p.knoten.filter((n) => n.rolle === 'nabe')) {
						const neighbours = p.knoten.filter(
							(m) =>
								m.rolle === 'nabe' &&
								Math.abs(Math.hypot(...m.p.map((v, i) => v - n.p[i])) - A) < EPS_M
						);
						if (neighbours.length === 12) assert.equal(valenz.get(n.id), 12);
					}
					const zs = [
						...new Set(p.knoten.filter((k) => k.rolle === 'nabe').map((k) => k.p[2]))
					].sort((a, b) => a - b);
					assert.equal(zs[0], 8);
					for (let i = 1; i < zs.length; i++) nahe(zs[i] - zs[i - 1], H, 10);
					for (const z of p.zellen)
						nahe(
							z.volumenM3,
							z.id.includes(':tet:') ? A ** 3 / (6 * Math.sqrt(2)) : (A ** 3 * Math.sqrt(2)) / 3,
							10
						);
				}
	});
	test('five occupancy values keep IDs and incidence; the loop matches the four text steps', () => {
		const ref = topology(plan());
		for (const belegung of [0, 0.25, 0.5, 0.75, 1])
			assert.deepEqual(topology(plan({ belegung })), ref);
		assert.deepEqual(
			raumfachwerk.loop.map((s) => s.name),
			['Tetrahedron', 'Octahedron', 'Layer', 'Occupancy']
		);
		for (const phase of [0, 1, 2, 3]) assert.deepEqual(pruefePlan(plan({ phase })), []);
	});
});

test('rectangular window: rows stay parallel to x, half offset instead of accumulated shear', () => {
	const p = plan(),
		nodes = p.knoten.filter((n) => n.rolle === 'nabe');
	const rows = new Map<string, number[]>();
	for (const n of nodes) {
		const key = `${n.p[1]}:${n.p[2]}`;
		rows.set(key, [...(rows.get(key) ?? []), n.p[0]]);
	}
	for (const xs of rows.values()) {
		xs.sort((a, b) => a - b);
		for (let i = 1; i < xs.length; i++) nahe(xs[i] - xs[i - 1], A, 9);
	}
	const base = nodes.filter((n) => n.p[2] === 8),
		ys = [...new Set(base.map((n) => n.p[1]))].sort((a, b) => a - b);
	const left = ys.map((y) => Math.min(...base.filter((n) => n.p[1] === y).map((n) => n.p[0])));
	assert.ok(Math.max(...left) - Math.min(...left) <= A / 2 + EPS_M);
	assert.equal(defaults.belegung, 0.15);
});
