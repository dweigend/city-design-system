import { describe, expect, test } from 'bun:test';
import { eckRaster, kanonisch, klassenHistogramm, klassenZahl, drehe } from './eck';
import { lagen, lage, jacobiane, pruefe, traegerPunkt } from './morph';
import { teile } from './split';
import { kennzahlen, pruefsumme, wachstum, wachstumsBild, GROESSE } from './wachstum';
import { Netz, flaechen } from './netz';
import { anziehung, feldlinien, glyphen, isolinien, sdf } from './feld';
import { cage, kontrollpunkte, minJacobian, treppenbreite, turm, uvw } from './cage';
import { universalBild } from './universal';

describe('Corner modules', () => {
	test('16 masks yield 6 classes, 256 yield 70 (Burnside)', () => {
		expect(new Set(Array.from({ length: 16 }, (_, m) => kanonisch(m))).size).toBe(6);
		expect(klassenZahl(4)).toBe(6);
		expect(klassenZahl(8)).toBe(70);
		expect(drehe(drehe(drehe(drehe(5))))).toBe(5);
	});
	test('deterministic per seed, a click toggles exactly one corner', () => {
		const a = eckRaster({ saat: 7 }),
			b = eckRaster({ saat: 7 });
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
		expect(JSON.stringify(eckRaster({ saat: 8 }).belegt)).not.toBe(JSON.stringify(a.belegt));
		const c = eckRaster({ saat: 7 }, new Set([10]));
		expect(c.belegt.filter((x, i) => x !== a.belegt[i]).length).toBe(1);
		expect(klassenHistogramm(a).reduce((s, n) => s + n, 0)).toBe(a.zellen.length);
	});
});

describe('Fixed carrier, moving embedding', () => {
	test('end points exact, topology fixed, return bit-identical', () => {
		const l = lagen({ saat: 3, staerke: 0.5 });
		expect([...lage(l, 0)]).toEqual([...l.a]);
		expect([...lage(l, 1)]).toEqual([...l.b]);
		expect(jacobiane(lage(l, 0.5), l.traeger).length).toBe(l.traeger.quads.length);
		expect(JSON.stringify(lagen({ saat: 3, staerke: 0.5 }))).toBe(JSON.stringify(l));
	});
	test('a convex boundary does not fold, a lobed boundary does at high strength', () => {
		for (const saat of [1, 19, 45]) {
			expect(pruefe(lagen({ saat, staerke: 1, rand: 'konvex' }), 1).gekippt).toBe(0);
		}
		const g = pruefe(lagen({ saat: 1, staerke: 1, rand: 'gelappt' }), 1);
		expect(g.gekippt).toBeGreaterThan(0);
		expect(g.ersteFaltung).not.toBeNull();
	});
	test('carrier point hits corner vertex', () => {
		const l = lagen({ saat: 1 });
		const p = lage(l, 0.3);
		expect(traegerPunkt(p, 12, [2, 3])).toEqual([p[(3 * 13 + 2) * 2], p[(3 * 13 + 2) * 2 + 1]]);
	});
});

describe('Split-Grammar', () => {
	test('IDs stable over t, area preserved', () => {
		const a = teile({ saat: 5, tiefe: 5, t: 0, zugangsregel: false }),
			b = teile({ saat: 5, tiefe: 5, t: 1, zugangsregel: false });
		expect(a.blaetter.map((x) => x.id)).toEqual(b.blaetter.map((x) => x.id));
		const uv = (t: typeof a) =>
			t.blaetter.reduce((s, x) => s + (x.uv[2] - x.uv[0]) * (x.uv[3] - x.uv[1]), 0);
		expect(uv(a)).toBeCloseTo(1, 9);
		expect(uv(b)).toBeCloseTo(1, 9);
	});
	test('access rule keeps every parcel on the frontage', () => {
		for (const saat of [1, 19, 45]) {
			const mit = teile({ saat, tiefe: 6, t: 0.5, zugangsregel: true });
			expect(mit.blaetter.every((x) => x.zugang)).toBe(true);
			const ohne = teile({ saat, tiefe: 6, t: 0.5, zugangsregel: false });
			expect(ohne.blaetter.some((x) => !x.zugang)).toBe(true);
		}
	});
});

describe('Growth', () => {
	test('faces of a square with a cross', () => {
		const n = new Netz();
		const p = [
			[0, 0],
			[2, 0],
			[2, 2],
			[0, 2]
		].map(([x, y]) => n.knoten(x, y, true));
		p.forEach((a, i) => n.verbinde(a, p[(i + 1) % 4], 0, 3));
		const e = n.treffer([1, -1], [1, 3]);
		expect(e.length).toBe(2);
		const a = n.teile(e[0].kante, e[0].u),
			b = n.teile(e[1].kante, e[1].u);
		n.verbinde(a, b, 1, 0);
		const f = flaechen(n, n.lebend()).filter((x) => x.flaeche > 0);
		expect(f.map((x) => x.flaeche).sort()).toEqual([2, 2]);
	});
	for (const familie of ['zugang', 'feld', 'ring'] as const)
		test(`${familie}: deterministic, history monotonic, blocks cover at most the frame`, () => {
			const a = wachstum({ familie, saat: 19 }),
				b = wachstum({ familie, saat: 19 });
			expect(pruefsumme(a)).toBe(pruefsumme(b));
			expect(pruefsumme(wachstum({ familie, saat: 20 }))).not.toBe(pruefsumme(a));
			const k0 = kennzahlen(a, 0),
				k5 = kennzahlen(a, 0.5),
				k1 = kennzahlen(a, 1);
			expect(k0.wege).toBe(0);
			expect(k5.wege).toBeLessThanOrEqual(k1.wege);
			expect(k1.bloecke).toBeGreaterThan(20);
			expect(k1.h).toBeGreaterThan(0);
			expect(k1.h).toBeLessThanOrEqual(1);
			const flaeche = flaechen(a.netz, a.netz.lebend())
				.filter((f) => f.flaeche > 0)
				.reduce((s, f) => s + f.flaeche, 0);
			expect(flaeche).toBeCloseTo(GROESSE * GROESSE, 3);
			expect(wachstumsBild(a, 1).bloecke.length).toBeGreaterThan(0);
		});
});

describe('Fields', () => {
	test('deterministic and isolines present', () => {
		expect(JSON.stringify(glyphen({ saat: 2, wirbel: 0.5 }))).toBe(
			JSON.stringify(glyphen({ saat: 2, wirbel: 0.5 }))
		);
		expect(feldlinien({ saat: 2, wirbel: 0.5 }).length).toBe(7);
		const f = sdf(2, 8);
		expect(isolinien(f, 0).length).toBeGreaterThan(10);
		expect(f(-1000, -1000)).toBeGreaterThan(0);
	});
});

describe('Cage', () => {
	test('rest position is identity, plinth stays fixed, Jacobian positive', () => {
		const ruhe = kontrollpunkte({ saat: 1, scherung: 0, verjuengung: 0, drehung: 0 });
		for (const k of turm(1).slice(0, 20)) {
			const p = cage(ruhe, uvw(k.min));
			k.min.forEach((v, i) => expect(p[i]).toBeCloseTo(v, 9));
		}
		const c = kontrollpunkte({ saat: 1, scherung: 0.1, verjuengung: 0.08, drehung: 0.3 });
		expect(c.slice(0, 4)).toEqual(ruhe.slice(0, 4));
		expect(minJacobian(c)).toBeGreaterThan(0.9);
		expect(treppenbreite(ruhe)).toBeCloseTo(1.56, 9);
		expect(treppenbreite(c)).toBeLessThan(1.5);
		expect(JSON.stringify(turm(4))).toBe(JSON.stringify(turm(4)));
	});
});

describe('Universal grid', () => {
	test('real toPatch: square 25 cells → 100 quads', () => {
		const b = universalBild('square', 42, () => 0);
		expect(b.anzahlZellen).toBe(25);
		expect(b.anzahlQuads).toBe(100);
		expect(b.minWinkel).toBeCloseTo(90, 6);
		expect(universalBild('hex', 42, () => 0).quads).toBe(universalBild('hex', 42, () => 0).quads);
	});
});

describe('Fields: moving the source', () => {
	test('without a center the field of the seed stays; a center changes only the density', () => {
		const o = { saat: 5, wirbel: 0.6 };
		expect(glyphen({ ...o, kern: undefined })).toEqual(glyphen(o));
		expect(feldlinien({ ...o, kern: [10, 10] })).toEqual(feldlinien(o));
		expect(glyphen({ ...o, kern: [10, 10] })).not.toEqual(glyphen(o));
	});
	test('attraction: the tallest building stands closest to the source', () => {
		const quelle: [number, number] = [30, 60];
		const t = anziehung(quelle);
		expect(t).toHaveLength(81);
		const abstand = (x: { x: number; y: number }) => Math.hypot(x.x - quelle[0], x.y - quelle[1]);
		const sortiert = [...t].sort((a, b) => abstand(a) - abstand(b));
		for (let i = 1; i < sortiert.length; i++)
			expect(sortiert[i].hoehe).toBeLessThanOrEqual(sortiert[i - 1].hoehe + 1e-12);
		expect(anziehung(quelle)).toEqual(t);
	});
});
