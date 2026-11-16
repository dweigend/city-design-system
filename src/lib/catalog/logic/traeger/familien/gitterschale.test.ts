import { describe, it as test } from 'node:test';
import assert from 'node:assert/strict';
import { gitterschale, kraftdichteNetz, GLEICHGEWICHT_TOLERANZ } from './gitterschale';
import { pruefePlan } from '../plan';
const start = Object.fromEntries(gitterschale.parameter.map((p) => [p.id, p.start]));
const plan = (werte: Record<string, number> = {}, saat = 42) =>
	gitterschale.planen({ ...start, ...werte }, saat);
const topologie = (p: ReturnType<typeof plan>) => ({
	knoten: p.knoten.map((k) => [k.id, k.rolle]),
	kanten: p.kanten,
	flaechen: p.flaechen,
	zellen: p.zellen,
	belegung: p.belegung
});
describe('Gridshell · force density', () => {
	test('start and all resolutions/edges/loop targets are valid executable examples', () => {
		assert.deepEqual(pruefePlan(plan()), []);
		for (const maschen of [8, 12, 16])
			for (const grundriss of [0, 1, 2])
				for (const phase of [0, 1, 2]) {
					const p = plan({ maschen, grundriss, phase });
					assert.deepEqual(pruefePlan(p), []);
					const zeilen = grundriss === 2 ? 3 * maschen : maschen;
					assert.equal(p.knoten.length, (maschen + 1) * (zeilen + 1));
					assert.equal(p.kanten.length, maschen * (zeilen + 1) + zeilen * (maschen + 1));
					assert.equal(p.flaechen.length, maschen * zeilen);
				}
	});
	test('the residual lies below the named scaled meter tolerance, also for reference 9×9', () => {
		for (const n of [8, 9, 12, 16])
			for (const g of [0, 1, 2])
				for (const d of [0, 0.25, 0.5, 0.75, 1]) {
					const netz = kraftdichteNetz(n, d, g);
					assert.equal(netz.konvergiert, true);
					assert.ok(netz.residuum < GLEICHGEWICHT_TOLERANZ);
					// Independent force balance from plan edges, rather than trusting the solver diagnostic.
					const p = plan({ maschen: n, grundriss: g, durchhang: d, phase: 1 });
					const nodes = new Map(p.knoten.map((k) => [k.id, k]));
					for (const k of p.knoten.filter((k) => k.rolle === 'frei')) {
						const neighbors = p.kanten
							.filter((e) => e.a === k.id || e.b === k.id)
							.map((e) => {
								const neighbor = nodes.get(e.a === k.id ? e.b : e.a);
								if (!neighbor) throw new Error('Missing neighbor');
								return neighbor;
							});
						const r = k.p.map(
							(v, axis) =>
								v -
								neighbors.reduce((s, b) => s + b.p[axis], axis === 2 ? netz.last : 0) /
									neighbors.length
						);
						assert.ok(Math.hypot(...r) < GLEICHGEWICHT_TOLERANZ);
					}
				}
	});
	test('all edge anchors stay exactly prescribed, independent of load', () => {
		for (const n of [8, 12, 16])
			for (const g of [0, 1, 2]) {
				const a = kraftdichteNetz(n, 0, g),
					b = kraftdichteNetz(n, 1, g);
				const zeilen = g === 2 ? 3 * n : n;
				assert.equal(a.anker.length, 2 * (n + zeilen));
				for (const id of a.anker) {
					assert.deepEqual(a.punkte[id], b.punkte[id]);
					const u = (2 * (id % (n + 1))) / n - 1;
					const v = (2 * Math.floor(id / (n + 1))) / zeilen - 1;
					assert.equal(
						a.punkte[id][2],
						g === 2 ? -5 * Math.sin(Math.PI * v) ** 2 : g === 1 ? -5 * (1 - u * u) : 0
					);
				}
			}
	});
	test('two runs are bit-identical; the seed affects only the occupancy', () => {
		assert.deepEqual(plan(), plan());
		const a = kraftdichteNetz(16, 0.35, 2),
			b = kraftdichteNetz(16, 0.35, 2);
		assert.deepEqual(
			Buffer.from(new Float64Array(a.punkte.flat()).buffer),
			Buffer.from(new Float64Array(b.punkte.flat()).buffer)
		);
		assert.deepEqual(plan({}, 1).knoten, plan({}, 2).knoten);
	});
	test('both symmetry axes are preserved in equilibrium', () => {
		for (const n of [8, 12, 16])
			for (const g of [0, 1, 2]) {
				const netz = kraftdichteNetz(n, 0.35, g);
				const zeilen = g === 2 ? 3 * n : n;
				for (let y = 0; y <= zeilen; y++)
					for (let x = 0; x <= n; x++) {
						const a = netz.punkte[y * (n + 1) + x],
							b = netz.punkte[y * (n + 1) + n - x],
							c = netz.punkte[(zeilen - y) * (n + 1) + x];
						for (const value of [
							a[0] + b[0],
							a[1] - b[1],
							a[2] - b[2],
							a[0] - c[0],
							a[1] + c[1],
							a[2] - c[2]
						])
							assert.ok(Math.abs(value) < GLEICHGEWICHT_TOLERANZ);
					}
			}
	});
	test('the rise grows strictly monotonically; the square reaches 2 and 9 meters', () => {
		for (const n of [8, 12, 16])
			for (const g of [0, 1, 2]) {
				const heights = [0, 0.25, 0.5, 0.75, 1].map((d) =>
					Math.max(...plan({ maschen: n, grundriss: g, durchhang: d }).knoten.map((k) => k.p[2]))
				);
				for (let i = 1; i < heights.length; i++) assert.ok(heights[i] > heights[i - 1]);
				if (g === 0) {
					assert.ok(Math.abs(heights[0] - 2) < 1e-10);
					assert.ok(Math.abs(heights[4] - 9) < 1e-10);
				}
			}
	});
	test('continuous sag and phase keep identities, lists and order', () => {
		const a = topologie(plan());
		for (const durchhang of [0, 0.25, 0.5, 0.75, 1])
			for (const phase of [0, 0.5, 1, 1.5, 2])
				assert.deepEqual(topologie(plan({ durchhang, phase })), a);
	});
	test('inverting keeps the whole hanging form through z-mirroring', () => {
		const a = plan({ phase: 1 }),
			b = plan({ phase: 2 });
		a.knoten.forEach((k, i) => {
			assert.deepEqual(b.knoten[i].p, [k.p[0], k.p[1], -k.p[2]]);
		});
	});
	test('membrane fields calmly occupied, the courtyard stays without a cell because of open end arches', () => {
		const p = plan();
		assert.deepEqual(p.zellen, []);
		assert.equal(
			p.flaechen.every((f) => f.rolle === 'membran'),
			true
		);
		assert.equal(
			p.kanten.every((k) => k.rolle === 'rippe'),
			true
		);
		const flows = Object.values(p.belegung).filter((s) => s !== 'leer');
		assert.equal(flows.length, Math.floor(p.flaechen.length * 0.12));
		assert.deepEqual(new Set(flows), new Set(['energy', 'water']));
	});
	test('landscape as default: two crests, a saddle, ground bearings and walkable arches', () => {
		assert.equal(start.grundriss, 2);
		for (const maschen of [8, 12, 16])
			for (const durchhang of [0, 0.35, 1]) {
				const p = plan({ maschen, durchhang });
				const n = maschen,
					mitte = 1.5 * n;
				const hoehe = (y: number, x = n / 2) => p.knoten[y * (n + 1) + x].p[2];
				const sued = Math.max(...Array.from({ length: mitte }, (_, y) => hoehe(y)));
				const nord = Math.max(...Array.from({ length: mitte }, (_, y) => hoehe(y + mitte + 1)));
				assert.ok(sued > hoehe(mitte) + 0.7);
				assert.ok(nord > hoehe(mitte) + 0.7);
				assert.ok(hoehe(mitte, 0) < 1e-10);
				assert.ok(hoehe(Math.round(0.75 * n), 0) >= 3);
				assert.ok(hoehe(Math.round(2.25 * n), n) >= 3);
				assert.ok(p.knoten.every((k) => k.p[2] >= -1e-10));
				assert.equal(Math.max(...p.knoten.map((k) => k.p[1])), 15);
			}
	});
	test('both flow bands are connected, in the saddle and on the southern crest', () => {
		for (const n of [8, 12, 16])
			for (const saat of [0, 1, 42, 4294967295]) {
				const p = plan({ maschen: n }, saat);
				assert.equal(
					Object.values(p.belegung).filter((v) => v !== 'leer').length,
					Math.floor(p.flaechen.length * 0.12)
				);
				for (const strom of ['water', 'energy']) {
					const felder = p.flaechen.filter((f) => p.belegung[f.id] === strom);
					const erreicht = new Set([felder[0].id]);
					for (let i = 0; i < felder.length; i++)
						for (const a of felder)
							if (erreicht.has(a.id))
								for (const b of felder)
									if (b.knoten.filter((k) => a.knoten.includes(k)).length === 2) erreicht.add(b.id);
					assert.equal(erreicht.size, felder.length);
					for (const f of felder) {
						const y = Number(f.id.split(':').at(-1));
						assert.ok(strom === 'water' ? y >= 1.5 * n && y < 2 * n : y < 1.5 * n);
					}
				}
			}
	});
	test('the loop follows the text steps, hides helper parameters and covers the roof only at the end', () => {
		assert.deepEqual(
			gitterschale.loop.map((s) => s.name),
			['Net', 'Hang', 'Invert', 'Roof']
		);
		for (const id of ['phase', 'dach'])
			assert.equal(gitterschale.parameter.find((p) => p.id === id)?.verborgen, true);
		gitterschale.loop.forEach((s, i) => {
			const p = plan(s.werte as Record<string, number>);
			assert.deepEqual(pruefePlan(p), []);
			assert.equal(
				p.flaechen.every((f) => f.rolle === (i === 3 ? 'membran' : 'offen')),
				true
			);
		});
	});
});
