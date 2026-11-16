import { describe, it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import { wabe } from './wabe';
import { pruefePlan, type TraegerPlan } from '../plan';

function expect<T>(actual: T) {
	return {
		toEqual: (expected: unknown) => assert.deepEqual(actual, expected),
		toBe: (expected: unknown) => assert.equal(actual, expected),
		toHaveLength: (expected: number) => assert.equal((actual as unknown[]).length, expected),
		toBeCloseTo: (expected: number, digits: number) =>
			assert.ok(Math.abs(Number(actual) - expected) < 10 ** -digits),
		toBeLessThan: (expected: number) => assert.ok(Number(actual) < expected),
		toBeLessThanOrEqual: (expected: number) => assert.ok(Number(actual) <= expected),
		toBeGreaterThan: (expected: number) => assert.ok(Number(actual) > expected),
		toContain: (expected: unknown) => assert.ok((actual as unknown[]).includes(expected)),
		not: { toEqual: (expected: unknown) => assert.notDeepEqual(actual, expected) }
	};
}
const start = Object.fromEntries(wabe.parameter.map((p) => [p.id, p.start]));
const bauen = (werte: Record<string, number> = {}, saat = 42) =>
	wabe.planen({ ...start, ...werte }, saat);
function hole<K, V>(map: Map<K, V>, key: K): V {
	const wert = map.get(key);
	if (wert === undefined) throw new Error(`Missing reference: ${key}`);
	return wert;
}
const VOLUMEN_M3 = ((3 * Math.sqrt(3)) / 2) * 3.5 ** 3;
const LAENGENTOLERANZ_M = 1e-9 * 3.5;
function besitzer(plan: TraegerPlan) {
	const out = new Map<string, string[]>();
	for (const z of plan.zellen)
		for (const f of z.flaechen) out.set(f, [...(out.get(f) ?? []), z.id]);
	return out;
}

describe('Honeycomb: executable contract examples', () => {
	for (const [name, werte, anzahl] of [
		['one real prism', { aufbau: 0, lagen: 1 }, 1],
		['six rooms around the shaft', { ringe: 1, lagen: 1, stufen: 0 }, 6],
		['two rings in three layers', { ringe: 2, lagen: 3, stufen: 0 }, 54],
		['stepped tower with terraces', { ringe: 2, lagen: 7, stufen: 2 }, 102],
		['three rings with three roof heights', { ringe: 3, lagen: 7, stufen: 2 }, 156]
	] as const) {
		test(name, () => {
			const p = bauen(werte);
			expect(pruefePlan(p)).toEqual([]);
			expect(p.zellen.filter((z) => z.nutzung !== 'schacht')).toHaveLength(anzahl);
			for (const z of p.zellen) {
				expect(z.flaechen).toHaveLength(8);
				expect(z.volumenM3).toBeCloseTo(VOLUMEN_M3, 10);
			}
		});
	}
});

test('every parameter case and every loop step is a valid cell complex', () => {
	for (const ringe of [1, 2, 3])
		for (const lagen of [1, 3, 5, 7])
			for (const stufen of [0, 1, 2]) {
				expect(pruefePlan(bauen({ ringe, lagen, stufen }))).toEqual([]);
			}
	for (const s of wabe.loop)
		expect(
			pruefePlan(
				bauen(
					Object.fromEntries(
						Object.entries(s.werte).filter(
							(pair): pair is [string, number] => pair[1] !== undefined
						)
					)
				)
			)
		).toEqual([]);
	expect(wabe.loop.map((s) => s.name)).toEqual(['Cell', 'Ring', 'Layers', 'Terraces']);
});

test('interior walls and floor slabs have exactly two owners with the same ID', () => {
	const p = bauen({ ringe: 2, lagen: 3, stufen: 0 }),
		owners = besitzer(p);
	const nodes = new Map(p.knoten.map((k) => [k.id, k.p]));
	let innenwaende = 0,
		zwischendecken = 0;
	for (const f of p.flaechen) {
		const n = owners.get(f.id)?.length;
		expect(n === 1 || n === 2).toBe(true);
		const points = f.knoten.map((k) => hole(nodes, k));
		if (f.knoten.length === 6) {
			const z = points[0][2];
			expect(n).toBe(z === 0 || z === 10.5 ? 1 : 2);
			if (n === 2) zwischendecken++;
		} else {
			expect(f.knoten).toHaveLength(4);
			if (n === 2) innenwaende++;
		}
	}
	expect(zwischendecken).toBe(38);
	// 6 connections in the first ring, 18 between rings, 12 in the outer ring.
	expect(innenwaende).toBe(42 * 3);
});

test('the shaft is empty, open and bounded by six walls on all seven layers', () => {
	const p = bauen(),
		nodes = new Map(p.knoten.map((k) => [k.id, k.p]));
	expect(p.zellen.filter((z) => z.nutzung === 'schacht')).toHaveLength(7);
	for (const z of p.zellen.filter((z) => z.nutzung === 'schacht'))
		expect(p.belegung[z.id]).toBe('leer');
	const apothem = (3.5 * Math.sqrt(3)) / 2;
	for (let l = 0; l < 7; l++) {
		const waende = p.flaechen.filter((f) => {
			if (f.knoten.length !== 4) return false;
			const ps = f.knoten.map((id) => hole(nodes, id));
			const x = ps.reduce((s, p) => s + p[0], 0) / 4,
				y = ps.reduce((s, p) => s + p[1], 0) / 4;
			return (
				Math.abs(Math.hypot(x, y) - apothem) < LAENGENTOLERANZ_M &&
				Math.min(...ps.map((p) => p[2])) === l * 3.5
			);
		});
		expect(waende).toHaveLength(6);
	}
	for (const f of p.flaechen.filter((f) => f.rolle === 'boden')) {
		const ps = f.knoten.map((id) => hole(nodes, id));
		expect(
			Math.hypot(ps.reduce((s, p) => s + p[0], 0) / 6, ps.reduce((s, p) => s + p[1], 0) / 6)
		).toBeGreaterThan(3.5);
	}
});

test('all cells are reachable through shared walls or slabs', () => {
	const p = bauen({ ringe: 3 }),
		owners = besitzer(p);
	const graph = new Map(p.zellen.map((z) => [z.id, new Set<string>()]));
	for (const pair of owners.values())
		if (pair.length === 2) {
			hole(graph, pair[0]).add(pair[1]);
			hole(graph, pair[1]).add(pair[0]);
		}
	const seen = new Set([p.zellen[0].id]),
		queue = [...seen];
	for (let i = 0; i < queue.length; i++)
		for (const id of hole(graph, queue[i]))
			if (!seen.has(id)) {
				seen.add(id);
				queue.push(id);
			}
	expect(seen.size).toBe(p.zellen.length);
});

test('vertical columns, hexagonal ring beams and bearings have real dimensions', () => {
	const p = bauen(),
		nodes = new Map(p.knoten.map((k) => [k.id, k]));
	for (const e of p.kanten) {
		const a = hole(nodes, e.a).p,
			b = hole(nodes, e.b).p;
		expect(Math.abs(Math.hypot(...a.map((v, i) => v - b[i])) - 3.5)).toBeLessThan(
			LAENGENTOLERANZ_M
		);
		expect(e.rolle).toBe(a[2] === b[2] ? 'nebenstab' : 'stab');
	}
	for (const k of p.knoten) expect(k.rolle).toBe(k.p[2] === 0 ? 'lager' : 'frei');
});

test('terraces are free hexagonal roof slabs at 17.5 m and 24.5 m', () => {
	const p = bauen(),
		owners = besitzer(p),
		nodes = new Map(p.knoten.map((k) => [k.id, k.p]));
	const roofs = p.flaechen.filter(
		(f) => f.rolle === 'boden' && hole(owners, f.id).length === 1 && hole(nodes, f.knoten[0])[2] > 0
	);
	expect(roofs).toHaveLength(18);
	expect([...new Set(roofs.map((f) => hole(nodes, f.knoten[0])[2]))].sort((a, b) => a - b)).toEqual(
		[17.5, 24.5]
	);
	expect(Object.values(p.belegung)).toContain('food');
});

test('continuous occupancy keeps positions, identities, lists and order', () => {
	const basis = bauen({ belegung: 0 });
	const struktur = (p: TraegerPlan) => ({
		knoten: p.knoten,
		kanten: p.kanten,
		flaechen: p.flaechen,
		zellen: p.zellen
	});
	for (const belegung of [0, 0.2, 0.4, 0.7, 1]) {
		const p = bauen({ belegung });
		const b = p.belegung;
		expect(struktur(p)).toEqual(struktur(basis));
		expect(Object.keys(b).sort()).toEqual(Object.keys(basis.belegung).sort());
	}
});

test('the same inputs yield the bit-identical plan; the seed changes no structure', () => {
	expect(bauen()).toEqual(bauen());
	expect(bauen({}, -1)).toEqual(bauen({}, 0xffffffff));
	const p = bauen({}, 1),
		q = bauen({}, 2);
	expect(p.knoten).toEqual(q.knoten);
	expect(p.kanten).toEqual(q.kanten);
	expect(p.flaechen).toEqual(q.flaechen);
	expect(p.belegung).not.toEqual(q.belegung);
});

test('start design: at least three fifths neutral, gardens only on free roof decks', () => {
	const p = bauen(),
		owners = besitzer(p);
	assert.equal(start.belegung, 0.2);
	const occupied = Object.entries(p.belegung).filter(([, v]) => v !== 'leer');
	assert.ok(occupied.length <= Object.keys(p.belegung).length * 0.4);
	assert.ok(
		new Set(occupied.filter(([id]) => id.startsWith('wabe:z:')).map(([, v]) => v)).size <= 2
	);
	const nodes = new Map(p.knoten.map((n) => [n.id, n.p]));
	for (const [id, flow] of occupied.filter(([id]) => id.startsWith('wabe:f:'))) {
		assert.equal(flow, 'food');
		const f = hole(new Map(p.flaechen.map((f) => [f.id, f])), id);
		assert.equal(f.rolle, 'boden');
		assert.equal(hole(owners, id).length, 1);
		const z = hole(nodes, f.knoten[0])[2];
		assert.ok(z > 0);
		assert.ok(
			!p.flaechen.some(
				(g) =>
					g.rolle === 'boden' &&
					hole(nodes, g.knoten[0])[2] > z &&
					Math.abs(
						g.knoten.reduce((s, id) => s + hole(nodes, id)[0], 0) / 6 -
							f.knoten.reduce((s, id) => s + hole(nodes, id)[0], 0) / 6
					) < 1e-8 &&
					Math.abs(
						g.knoten.reduce((s, id) => s + hole(nodes, id)[1], 0) / 6 -
							f.knoten.reduce((s, id) => s + hole(nodes, id)[1], 0) / 6
					) < 1e-8
			)
		);
	}
});
test('shared corners have exactly one column per layer', () => {
	const p = bauen(),
		nodes = new Map(p.knoten.map((n) => [n.id, n.p]));
	const segments = p.kanten
		.filter((e) => e.rolle === 'stab')
		.map((e) =>
			[hole(nodes, e.a), hole(nodes, e.b)]
				.sort((a, b) => a[2] - b[2])
				.flat()
				.map((x) => Math.round(x / LAENGENTOLERANZ_M))
				.join(',')
		);
	assert.equal(new Set(segments).size, segments.length);
});
