import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { planen, pruefePlan, loopZiel, type TraegerPlan, type Vec3 } from '../index';
import { faltwerk } from './faltwerk';

// Relative meter tolerance, scaled by the largest model coordinate.
const EBENHEIT_REL = 1e-10;
const LAENGE_REL = 1e-10;
const WINKEL = [0.05, 0.2, 0.4, 0.65, 0.85, 1];
const NEIGUNG = [50, 52.5, 55, 57.5, 60].map((v) => (v * Math.PI) / 180);
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
const dot = (a: Vec3, b: Vec3) => a.reduce((s, v, i) => s + v * b[i], 0);
const topology = (p: TraegerPlan) => ({
	knoten: p.knoten.map((k) => [k.id, k.rolle]),
	kanten: p.kanten,
	flaechen: p.flaechen,
	zellen: p.zellen.map((z) => [z.id, z.flaechen]),
	belegung: p.belegung
});
function required<T>(value: T | undefined): T {
	assert.notEqual(value, undefined);
	if (value === undefined) throw new Error('Missing node');
	return value;
}
function checkPlanes(p: TraegerPlan) {
	const nodes = new Map(p.knoten.map((k) => [k.id, k.p]));
	const span = Math.max(1, ...p.knoten.flatMap((k) => k.p.map(Math.abs)));
	for (const f of p.flaechen) {
		const ps = f.knoten.map((id) => required(nodes.get(id)));
		let normal: Vec3 = [0, 0, 0];
		for (let i = 1; i + 1 < ps.length; i++) {
			const candidate = cross(sub(ps[i], ps[0]), sub(ps[i + 1], ps[0]));
			if (Math.hypot(...candidate) > Math.hypot(...normal)) normal = candidate;
		}
		assert.ok(Math.hypot(...normal) > LAENGE_REL * span ** 2, f.id);
		for (const v of ps)
			assert.ok(
				Math.abs(dot(sub(v, ps[0]), normal)) / Math.hypot(...normal) < EBENHEIT_REL * span,
				f.id
			);
	}
}

describe('Folded tent · accepted examples', () => {
	test('two Miura strips form wall and roof themselves, a closed hall', () => {
		const p = planen('faltwerk');
		assert.equal(p.flaechen.filter((f) => f.rolle === 'paneel').length, 72);
		assert.equal(p.flaechen.filter((f) => f.rolle === 'glas').length, 2);
		assert.equal(p.zellen.length, 1);
		assert.deepEqual(pruefePlan(p), []);
		const size = [0, 1, 2].map(
			(i) => Math.max(...p.knoten.map((k) => k.p[i])) - Math.min(...p.knoten.map((k) => k.p[i]))
		);
		assert.ok(size[0] > 10 && size[0] < 15);
		assert.ok(size[1] > 14 && size[1] < 20);
		assert.ok(size[2] > 8 && size[2] < 12);
	});
	test('ridge nodes are shared IDs; no geometric duplicate nodes', () => {
		for (const faltwinkel of WINKEL)
			for (const neigung of NEIGUNG) {
				const p = planen('faltwerk', { faltwinkel, neigung });
				const ridge = p.knoten.filter((k) => k.id.startsWith('faltwerk:first:'));
				assert.ok(ridge.length > 0);
				for (const k of ridge) {
					assert.equal(k.p[0], 0);
					for (const seite of [0, 1])
						assert.ok(
							p.flaechen.some(
								(f) => f.id.startsWith(`faltwerk:f:${seite}:`) && f.knoten.includes(k.id)
							)
						);
				}
				for (let i = 0; i < p.knoten.length; i++)
					for (let j = i + 1; j < p.knoten.length; j++)
						assert.ok(Math.hypot(...sub(p.knoten[i].p, p.knoten[j].p)) > 1e-9);
				const first = new Set(ridge.map((k) => k.id));
				const edges = p.kanten.filter((e) => first.has(e.a) && first.has(e.b));
				assert.equal(edges.length, ridge.length - 1);
			}
	});
	test('trimmed panels, end glass and floor also stay exactly planar; foot points are bearings', () => {
		for (const faltwinkel of WINKEL)
			for (const neigung of NEIGUNG) {
				const p = planen('faltwerk', { faltwinkel, neigung });
				checkPlanes(p);
				assert.ok(p.knoten.some((k) => k.rolle === 'lager'));
				for (const k of p.knoten) {
					assert.ok(k.p[2] >= 0);
					if (k.rolle === 'lager') assert.equal(k.p[2], 0);
				}
				for (const f of p.flaechen.filter((f) => f.rolle === 'glas')) {
					const nodes = f.knoten.map((id) => required(p.knoten.find((k) => k.id === id)));
					assert.ok(nodes.every((k) => k.p[1] === nodes[0].p[1]));
				}
			}
	});
	test('rigid original panels keep 3.5 m edges and 60° sector angles while folding and raising', () => {
		// Cut edge lengths intentionally change with the cut position. Check the
		// complete material first, then the untouched interior panels of the hall.
		for (const zuschnitt of [0, 1])
			for (const faltwinkel of WINKEL)
				for (const neigung of NEIGUNG)
					for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
						const p = planen('faltwerk', { faltwinkel, neigung, phase, zuschnitt });
						checkPlanes(p);
						const nodes = new Map(p.knoten.map((k) => [k.id, k.p]));
						for (const f of p.flaechen.filter(
							(f) => f.rolle === 'paneel' && f.knoten.every((id) => id.startsWith('faltwerk:k:'))
						)) {
							const ps = f.knoten.map((id) => required(nodes.get(id)));
							for (let i = 0; i < 4; i++)
								assert.ok(
									Math.abs(Math.hypot(...sub(ps[i], ps[(i + 1) % 4])) - 3.5) < LAENGE_REL * 3.5
								);
							assert.ok(
								Math.abs(Math.abs(dot(sub(ps[1], ps[0]), sub(ps[3], ps[0]))) / 3.5 ** 2 - 0.5) <
									LAENGE_REL
							);
						}
					}
	});
	test('cut topology, roles and occupancy stay identical across the whole continuous range', () => {
		for (const bahnen of [4, 6, 8])
			for (const felder of [4, 6]) {
				const ref = topology(planen('faltwerk', { bahnen, felder }));
				// Uniform samples include both endpoints of the declared parameter domain.
				for (let t = 0; t <= 20; t++)
					for (let n = 0; n <= 20; n++) {
						const p = planen('faltwerk', {
							bahnen,
							felder,
							faltwinkel: 0.05 + (0.95 * t) / 20,
							neigung: ((50 + n / 2) * Math.PI) / 180
						});
						assert.deepEqual(topology(p), ref);
						assert.deepEqual(pruefePlan(p), []);
					}
			}
	});
	test('uncut strips keep IDs, roles and lists during continuous raising', () => {
		const ref = topology(planen('faltwerk', { zuschnitt: 0 }));
		for (const faltwinkel of WINKEL)
			for (const neigung of NEIGUNG)
				for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
					const p = planen('faltwerk', { zuschnitt: 0, faltwinkel, neigung, phase });
					assert.deepEqual(topology(p), ref);
					assert.ok(p.knoten.filter((k) => k.rolle === 'lager').every((k) => k.p[2] === 0));
				}
	});
	test('Maekawa holds at every untrimmed inner four-valent node', () => {
		for (const faltwinkel of WINKEL) {
			const p = planen('faltwerk', { faltwinkel, zuschnitt: 0, phase: 0.5 });
			for (const seite of [0, 1])
				for (let i = 1; i < 6; i++)
					for (let j = 1; j < 6; j++) {
						const id = `faltwerk:k:${seite}:${i}:${j}`;
						const es = p.kanten.filter(
							(e) => (e.a === id || e.b === id) && (e.rolle === 'berg' || e.rolle === 'tal')
						);
						assert.equal(es.length, 4);
						assert.equal(
							Math.abs(
								es.filter((e) => e.rolle === 'berg').length -
									es.filter((e) => e.rolle === 'tal').length
							),
							2
						);
					}
		}
	});
	test('four valid loop targets, one raised strip, deterministic calm solar occupancy', () => {
		assert.deepEqual(planen('faltwerk', {}, 123), planen('faltwerk', {}, 123));
		assert.deepEqual(
			faltwerk.loop.map((s) => s.name),
			['Sheet', 'Fold', 'Strip', 'House']
		);
		for (const bahnen of [4, 6, 8])
			for (const felder of [4, 6])
				for (let i = 0; i < 4; i++) {
					const p = planen('faltwerk', { ...loopZiel(faltwerk, i), bahnen, felder });
					assert.deepEqual(pruefePlan(p), []);
					checkPlanes(p);
				}
		const p = planen('faltwerk', loopZiel(faltwerk, 2));
		const height = (s: number) =>
			Math.max(...p.knoten.filter((k) => k.id.startsWith(`faltwerk:k:${s}:`)).map((k) => k.p[2]));
		assert.ok(height(0) > 3 * height(1));
		const house = planen('faltwerk');
		const occupied = Object.entries(house.belegung).filter(([, v]) => v !== 'leer');
		assert.ok(occupied.length > 0 && occupied.length < house.flaechen.length / 5);
		assert.ok(occupied.every(([id, v]) => id.startsWith('faltwerk:f:0:') && v === 'energy'));
		for (const id of ['phase', 'zuschnitt'])
			assert.equal(faltwerk.parameter.find((p) => p.id === id)?.verborgen, true);
	});
});
