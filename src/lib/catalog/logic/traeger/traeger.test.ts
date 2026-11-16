import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
	planen,
	familie,
	pruefePlan,
	kantenId,
	kanal,
	einheit,
	belege,
	loopZustand,
	figurOrt,
	gartenBoeden,
	loopZiel,
	type Parameter,
	type FamilieId,
	type TraegerPlan
} from './index';
function expect<T>(actual: T) {
	return {
		toEqual(expected: unknown) {
			assert.deepEqual(actual, expected);
		},
		toBe(expected: unknown) {
			assert.equal(actual, expected);
		},
		toBeLessThan(expected: number) {
			assert.ok(Number(actual) < expected);
		},
		toBeLessThanOrEqual(expected: number) {
			assert.ok(Number(actual) <= expected);
		},
		toHaveLength(expected: number) {
			assert.equal((actual as unknown[]).length, expected);
		},
		toThrow() {
			assert.throws(actual as () => void);
		},
		not: {
			toBe(expected: unknown) {
				assert.notEqual(actual, expected);
			},
			toEqual(expected: unknown) {
				assert.notDeepEqual(actual, expected);
			}
		}
	};
}
const ids: FamilieId[] = [
	'orthogonal',
	'faltwerk',
	'kuppel',
	'wabe',
	'raumfachwerk',
	'gitterschale'
];
const probe = (change: (p: TraegerPlan) => void, code: string) => {
	const p = planen('orthogonal');
	change(p);
	expect(pruefePlan(p).some((b) => b.code === code)).toBe(true);
};
describe('shared carrier contract', () => {
	for (const id of ids)
		it(`${id}: start values are valid and deterministic`, () => {
			expect(pruefePlan(planen(id))).toEqual([]);
			expect(planen(id)).toEqual(planen(id));
		});
	it('hash is a deterministic u32 with a normalized seed', () => {
		expect(kanal(42, 'wabe', 'a', 'strom')).toBe(4095624494);
		expect(kanal(-1, 'wabe', 'a', 'strom')).toBe(kanal(4294967295, 'wabe', 'a', 'strom'));
		expect(kanal(42, 'wabe', 'a', 'strom')).toBe(kanal(42, 'wabe', 'a', 'strom'));
		expect(einheit(0xffffffff)).toBeLessThan(1);
		expect(einheit(0)).toBe(0);
		expect(kanal(42, 'wabe', 'a', 'strom')).not.toBe(kanal(42, 'wabe', 'a', 'belegung'));
	});
	it('occupancy is independent of the input order and allows full use', () => {
		const p = planen('orthogonal');
		const options = { anteil: 1, stroeme: ['people', 'food'] as ('people' | 'food')[] };
		const a = belege(p, 42, 'orthogonal', options);
		expect(a).toEqual(
			belege(
				{ ...p, zellen: [...p.zellen].reverse(), flaechen: [...p.flaechen].reverse() },
				42,
				'orthogonal',
				options
			)
		);
		expect(Object.values(a).filter((v) => v !== 'leer').length).toBe(p.zellen.length);
		expect(() =>
			belege(p, 42, 'orthogonal', { anteil: 1, stroeme: ['people', 'food', 'water', 'energy'] })
		).toThrow();
	});
	it('zero-length edges, duplicate edges, missing end points', () => {
		probe((p) => (p.kanten[0].b = p.kanten[0].a), 'nullkante');
		probe((p) => p.kanten.push({ ...p.kanten[0], id: 'duplicate' }), 'kante-doppelt');
		probe((p) => (p.kanten[0].a = 'absent'), 'kanten-knoten');
	});
	it('coordinates and IDs', () => {
		probe((p) => (p.knoten[0].p[0] = NaN), 'koordinate-endlich');
		probe((p) => (p.knoten[1].id = p.knoten[0].id), 'id-doppelt');
		probe((p) => (p.werte.bad = Infinity), 'wert-endlich');
	});
	it('faces need nodes, boundaries and manifold edges', () => {
		probe((p) => (p.flaechen[0].knoten[0] = 'absent'), 'flaechen-knoten');
		probe((p) => p.kanten.pop(), 'flaechen-rand');
		probe(
			(p) => p.flaechen.push({ ...p.flaechen[0], id: 'f2' }, { ...p.flaechen[0], id: 'f3' }),
			'kante-nichtmannigfaltig'
		);
		probe((p) => p.flaechen[0].knoten.splice(0, p.flaechen[0].knoten.length - 2), 'flaeche-ring');
	});
	it('occupancy has only existing targets and at most three flows', () => {
		probe((p) => (p.belegung.absent = 'people'), 'belegung-id');
		probe(
			(p) => Object.assign(p.belegung, { a: 'people', b: 'water', c: 'food', d: 'energy' }),
			'belegung-stroeme'
		);
	});
	it('cells are closed and their actual volume is correct', () => {
		for (const [change, code] of [
			[(p: TraegerPlan) => p.zellen[0].flaechen.pop(), 'zelle-offen'],
			[(p: TraegerPlan) => p.zellen[0].flaechen.push('absent'), 'zellen-flaeche'],
			[(p: TraegerPlan) => (p.zellen[0].volumenM3 = -1), 'zellen-volumen'],
			[(p: TraegerPlan) => (p.zellen[0].volumenM3 = 99), 'zellen-volumen-abweichung'],
			[(p: TraegerPlan) => p.knoten.forEach((k) => (k.p[2] = 0)), 'zellen-volumen']
		] as const) {
			const p = planen('orthogonal');
			change(p);
			expect(pruefePlan(p).some((b) => b.code === code)).toBe(true);
		}
	});
	it('offset keeps identity and lists, all cells measure 3.5³ m³', () => {
		const a = planen('orthogonal', { versatz: 0 }),
			b = planen('orthogonal', { versatz: 1 });
		expect(a.knoten.map((k) => k.id)).toEqual(b.knoten.map((k) => k.id));
		expect(a.kanten).toEqual(b.kanten);
		expect(a.flaechen).toEqual(b.flaechen);
		expect(a.zellen).toEqual(b.zellen);
		expect(a.knoten).not.toEqual(b.knoten);
		for (const z of a.zellen) expect(z.volumenM3).toBe(3.5 ** 3);
		expect(pruefePlan(b)).toEqual([]);
	});
	it('a wall owned more than once and a disconnected cell envelope are reported', () => {
		const p = planen('orthogonal');
		p.zellen.push({ ...p.zellen[0], id: 'extra' });
		expect(pruefePlan(p).some((b) => b.code === 'flaeche-zellen')).toBe(true);
		const q = planen('orthogonal');
		q.zellen[0].flaechen.push(...(q.zellen.at(-1)?.flaechen ?? []));
		expect(pruefePlan(q).some((b) => b.code === 'zelle-orientierung')).toBe(true);
	});
	it('the volume check is translation-invariant', () => {
		const p = planen('orthogonal');
		for (const k of p.knoten) k.p = k.p.map((v) => v + 1e6) as [number, number, number];
		expect(pruefePlan(p)).toEqual([]);
	});
	it('neighbors share exactly one wall', () => {
		const p = planen('orthogonal');
		expect(p.zellen[0].flaechen.filter((id) => p.zellen[1].flaechen.includes(id))).toHaveLength(1);
		expect(kantenId('b', 'a')).toBe(kantenId('a', 'b'));
	});
	it('the loop is periodic, interpolates continuously and jumps discretely', () => {
		const f = familie('orthogonal');
		expect(loopZustand(f, 0)).toEqual(loopZustand(f, 16));
		expect(loopZustand(f, 10).werte.versatz).toBe(0.25);
		expect(loopZustand(f, 4).werte.lagen).toBe(2);
		expect(loopZustand(f, -1)).toEqual(loopZustand(f, 15));
	});
});

describe('optional core contracts', () => {
	it('hidden parameters of both kinds stay plannable', () => {
		const hidden: Parameter[] = [
			{
				art: 'diskret',
				id: 'phase',
				label: 'Phase',
				optionen: [{ wert: 0, label: '0' }],
				start: 0,
				verborgen: true
			},
			{
				art: 'stetig',
				id: 'hebung',
				label: 'Hebung',
				min: 0,
				max: 1,
				schritt: 0.1,
				start: 1,
				einheit: '',
				verborgen: true
			}
		];
		expect(hidden.filter((p) => !p.verborgen)).toEqual([]);
		const f = familie('kuppel');
		for (const p of f.parameter.filter((p) => p.verborgen))
			expect(planen('kuppel').werte[p.id]).toBe(p.start);
	});
	it('explicit targets of every face role are valid, stable and without a silent cap', () => {
		const p = planen('orthogonal');
		for (const role of ['paneel', 'glas', 'membran', 'boden', 'offen'] as const) {
			p.flaechen[0].rolle = role;
			const ziele = [p.flaechen[0].id, p.zellen[0].id];
			const options = { anteil: 1, stroeme: ['food'] as 'food'[], ziele };
			p.belegung = belege(p, 42, p.familie, options);
			expect(p.belegung).toEqual(
				belege(p, 42, p.familie, { ...options, ziele: [...ziele].reverse() })
			);
			expect(Object.values(p.belegung)).toEqual(['food', 'food']);
			expect(pruefePlan(p)).toEqual([]);
		}
		expect(belege(p, 42, p.familie, { anteil: 1, stroeme: ['food'], ziele: [] })).toEqual({});
		for (const anteil of [-1, 1.01, NaN])
			expect(() => belege(p, 42, p.familie, { anteil, stroeme: ['food'] })).toThrow();
		expect(() =>
			belege(p, 42, p.familie, { anteil: 1, stroeme: ['food'], ziele: ['absent'] })
		).toThrow();
	});
	it('a garden uses only the lower cell floor; direct food also occupies terrace decks', () => {
		const p = planen('orthogonal');
		p.belegung = {};
		p.zellen[0].nutzung = 'garten';
		p.zellen[1].nutzung = 'schacht';
		const first = gartenBoeden(p);
		expect(first.length).toBe(1);
		expect(first[0].rolle).toBe('boden');
		const extra = p.flaechen.find((f) => f.rolle === 'boden' && f.id !== first[0].id);
		assert.ok(extra);
		p.belegung[extra.id] = 'food';
		expect(gartenBoeden(p).length).toBe(2);
		expect(
			gartenBoeden({ ...p, zellen: [...p.zellen].reverse(), flaechen: [...p.flaechen].reverse() })
				.map((f) => f.id)
				.sort()
		).toEqual(
			gartenBoeden(p)
				.map((f) => f.id)
				.sort()
		);
		expect(pruefePlan(p)).toEqual([]);
	});
	it('the figure stands 1.2 m outside at the front bearing and at z=0', () => {
		for (const id of ['orthogonal', 'kuppel', 'wabe'] as const) {
			const p = planen(id),
				point = figurOrt(p);
			const anchor = [...p.knoten.filter((n) => n.rolle === 'lager')].sort(
				(a, b) => a.p[0] + a.p[1] - b.p[0] - b.p[1] || a.id.localeCompare(b.id)
			)[0];
			assert.ok(Math.abs(Math.hypot(point[0] - anchor.p[0], point[1] - anchor.p[1]) - 1.2) < 1e-10);
			expect(point[2]).toBe(0);
			assert.ok(point[0] + point[1] < anchor.p[0] + anchor.p[1]);
			expect(figurOrt({ ...p, knoten: [...p.knoten].reverse() })).toEqual(point);
		}
		const p = planen('orthogonal');
		p.knoten = [];
		expect(figurOrt(p)).toEqual([-1.2, 0, 0]);
	});
	it('step selection returns exact end values including inherited parameters', () => {
		const f = familie('orthogonal');
		for (let i = 0; i < f.loop.length; i++) {
			const target = loopZiel(f, i);
			for (const [key, value] of Object.entries(f.loop[i].werte)) expect(target[key]).toBe(value);
		}
	});
});
