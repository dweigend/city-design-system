// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, test, expect } from 'bun:test';
import {
	FELD,
	MUSTER,
	PHASE,
	SCHRITT,
	abstand,
	anteile,
	aufstellen,
	bruecken,
	hash,
	kugel,
	kiste,
	leere,
	mische,
	puffer,
	regler,
	ruhe,
	setze,
	strecke,
	turm,
	turmpuffer,
	typen,
	verformen,
	type Genom,
	type Palette,
	type Puffer,
	type Turmpuffer
} from './index';

const pal: Palette = {
	papier: [1, 1, 1],
	tinte: [0.07, 0.07, 0.07],
	signal: [0.88, 0.19, 0.12],
	strom: [
		[0.9, 0.28, 0.6],
		[0.18, 0.61, 0.88],
		[0.95, 0.82, 0.18],
		[0.21, 0.66, 0.33],
		[0.95, 0.55, 0.16]
	]
};
const klassen = ['gross', 'mittel', 'grob', 'haut'] as const;
const baue = (g: Genom, saat: number, in_ = turmpuffer()) => {
	leere(in_);
	return { p: in_, t: turm(g, saat, pal, in_) };
};
const zeilen = (p: Puffer) => p.daten.subarray(0, p.anzahl * SCHRITT);
const gleich = (a: Turmpuffer, b: Turmpuffer) =>
	klassen.every(
		(k) => a[k].anzahl === b[k].anzahl && zeilen(a[k]).every((v, i) => Object.is(v, b[k].daten[i]))
	);
/** Rows by fixed id, across all classes. */
const nachId = (p: Turmpuffer) => {
	const m = new Map<string, Float32Array>();
	for (const k of klassen)
		for (let i = 0; i < p[k].anzahl; i++) {
			const z = p[k].daten.subarray(i * SCHRITT, (i + 1) * SCHRITT);
			m.set(`${k}:${z[FELD.id]}`, z);
		}
	return m;
};

describe('L14 randomness and vocabulary', () => {
	test('hash is deterministic, lies in [0, 1) and scatters', () => {
		expect(hash(19, 7, 3)).toBe(hash(19, 7, 3));
		expect(hash(19, 7, 3)).not.toBe(hash(19, 7, 4));
		expect(hash(19, 7, 3)).not.toBe(hash(20, 7, 3));
		let sum = 0;
		for (let i = 0; i < 4000; i++) {
			const h = hash(45, i, 1);
			expect(h).toBeGreaterThanOrEqual(0);
			expect(h).toBeLessThan(1);
			sum += h;
		}
		expect(Math.abs(sum / 4000 - 0.5)).toBeLessThan(0.03);
	});
	test('anteile: sum 1, empty families stay empty, continuous in u and in the weight', () => {
		const w = [0.5, 0, 0.3, 0, 0.2, 1];
		let vorher = anteile(0, w);
		for (let u = 0; u <= 1; u += 0.001) {
			const a = anteile(u, w);
			expect(a.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 9);
			expect(a[1]).toBe(0);
			expect(a[3]).toBe(0);
			for (let i = 0; i < a.length; i++) {
				expect(a[i]).toBeGreaterThanOrEqual(0);
				expect(Math.abs(a[i] - vorher[i])).toBeLessThan(0.02);
			}
			vorher = a;
		}
		// A weight tends to zero: the family's share follows continuously.
		expect(anteile(0.02, [1e-6, 1])[0]).toBeLessThan(1e-4);
		expect(anteile(0.5, [0, 0, 0])).toEqual([1, 0, 0]);
	});
	test('primal form: between box and sphere there is always a valid form', () => {
		const p = puffer(1);
		for (let t = 0; t <= 1; t += 0.05) {
			p.anzahl = 0;
			setze(p, {
				id: 1,
				ort: [0, 0, 0],
				form: mische(kiste(3, 2, 1), kugel(2), t),
				farbe: [1, 1, 1]
			});
			const d = p.daten;
			expect(d[FELD.rxy]).toBeLessThanOrEqual(Math.min(d[FELD.halb], d[FELD.halb + 1]) + 1e-6);
			expect(d[FELD.rt]).toBeLessThanOrEqual(d[FELD.rxy] + 1e-6);
			expect(d[FELD.rt] + d[FELD.rb]).toBeLessThanOrEqual(2 * d[FELD.halb + 2] + 1e-6);
		}
	});
});

describe('L14 tower plan', () => {
	test('the same seed yields the same tower, regardless of what was built before', () => {
		for (const typ of typen) {
			const a = baue(typ.genom, 19).p;
			baue(typen[0].genom, 4); // unrelated run in between: no global state
			const wieder = turmpuffer();
			baue(typen[3].genom, 7, wieder); // the same buffer, previously filled differently
			const b = baue(typ.genom, 19, wieder).p;
			expect(gleich(a, b)).toBe(true);
			expect(gleich(a, baue(typ.genom, 20).p)).toBe(false);
		}
	});
	test('all rows are valid and fit into the fixed buffers', () => {
		const grenzen = (g: Genom, saat: number) => {
			const { p } = baue(g, saat);
			for (const k of klassen) {
				expect(p[k].anzahl).toBeLessThan(p[k].platz);
				const d = zeilen(p[k]);
				for (let i = 0; i < d.length; i++) expect(Number.isFinite(d[i])).toBe(true);
				for (let o = 0; o < d.length; o += SCHRITT) {
					const h = Math.min(d[o + FELD.halb], d[o + FELD.halb + 1]);
					expect(d[o + FELD.rxy]).toBeLessThanOrEqual(h + 1e-5);
					expect(d[o + FELD.rt]).toBeLessThanOrEqual(d[o + FELD.rxy] + 1e-5);
					expect(d[o + FELD.rb]).toBeLessThanOrEqual(d[o + FELD.rxy] + 1e-5);
				}
			}
		};
		for (const typ of typen) for (const saat of [1, 19, 45]) grenzen(typ.genom, saat);
		// Corners of the slider space: everything at its limit.
		const voll = { ...typen[4].genom };
		for (const r of regler) voll[r.key] = r.max;
		grenzen({ ...voll, treppe: 1, kern: 0.6 }, 3);
		const leer = { ...typen[0].genom };
		for (const r of regler) leer[r.key] = r.min;
		grenzen(leer, 3);
	});
	test('tower rule: every phase is present, existing stock stays still and stays white architectural model, structural frame is signal', () => {
		const { p } = baue(typen[1].genom, 19);
		const phasen = new Set<number>();
		for (const k of klassen)
			for (let o = 0; o < p[k].anzahl * SCHRITT; o += SCHRITT) {
				const d = p[k].daten,
					phase = d[o + FELD.phase];
				phasen.add(phase);
				if (phase === PHASE.bestand) {
					expect(d[o + FELD.traeger]).toBe(0);
					for (let c = 0; c < 3; c++) expect(d[o + FELD.farbe + c]).toBeGreaterThan(0.9);
				}
				if (phase === PHASE.rahmen)
					for (let c = 0; c < 3; c++) expect(d[o + FELD.farbe + c]).toBeCloseTo(pal.signal[c], 5);
			}
		expect([...phasen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
	});
	test('the position layer alone changes no row: round, inflate, twist, bend are uniforms only', () => {
		const g = typen[2].genom,
			a = baue(g, 19),
			b = baue({ ...g, rund: 0.1, bauch: 0.7, drall: -2.5, biegung: 0.8, verjuengung: -0.4 }, 19);
		expect(gleich(a.p, b.p)).toBe(true);
		expect(b.t.lage.drall).toBe(-2.5);
		expect(a.t.lage.hoehe).toBe(b.t.lage.hoehe);
	});
	test('color 0 is white architectural model: only structural frame, stairs and pipes still carry color', () => {
		const { p } = baue({ ...typen[1].genom, farbe: 0 }, 19);
		for (let o = 0; o < p.mittel.anzahl * SCHRITT; o += SCHRITT) {
			const d = p.mittel.daten;
			if (d[o + FELD.phase] !== PHASE.modul) continue;
			for (let c = 0; c < 3; c++) expect(d[o + FELD.farbe + c]).toBeCloseTo(1, 5);
		}
	});
});

describe('L14 Morph', () => {
	test('the path hits every type exactly and returns bit for bit', () => {
		typen.forEach((typ, i) => expect(abstand(strecke(i), typ.genom)).toBe(0));
		expect(strecke(2.37)).toEqual(strecke(2.37));
		expect(strecke(-3)).toEqual(typen[0].genom);
		expect(strecke(99)).toEqual(typen[typen.length - 1].genom);
		const hin = baue(strecke(1.4), 19).p;
		baue(strecke(5.2), 19);
		expect(gleich(hin, baue(strecke(1.4), 19).p)).toBe(true);
	});
	test('continuous along the whole path: no part jumps, new parts grow from nothing', () => {
		const SCHRITTWEITE = 0.002;
		let sprung = 0,
			keim = 0,
			vorher = nachId(baue(strecke(0), 19).p);
		for (let t = SCHRITTWEITE; t <= typen.length - 1; t += SCHRITTWEITE) {
			const jetzt = nachId(baue(strecke(t), 19).p);
			for (const [id, z] of jetzt) {
				const alt = vorher.get(id);
				const klein = Math.min(z[FELD.halb], z[FELD.halb + 1], z[FELD.halb + 2]);
				if (!alt) {
					keim = Math.max(keim, klein);
					continue;
				}
				for (let c = 0; c < 3; c++) {
					sprung = Math.max(sprung, Math.abs(z[FELD.ort + c] - alt[FELD.ort + c]));
					sprung = Math.max(sprung, Math.abs(z[FELD.halb + c] - alt[FELD.halb + c]));
				}
			}
			for (const [id, z] of vorher)
				if (!jetzt.has(id))
					keim = Math.max(keim, Math.min(z[FELD.halb], z[FELD.halb + 1], z[FELD.halb + 2]));
			vorher = jetzt;
		}
		// 0.2 % of the path between two types moves no part by more than 30 cm.
		expect(sprung).toBeLessThan(0.3);
		// Whatever appears or disappears is at most as thick as a pipe (radius 26 cm):
		// the moving pipe end. Everything else grows from zero.
		expect(keim).toBeLessThan(0.27);
	});
	test('slots keep their id: the same slot is the same before and after the morph', () => {
		const a = nachId(baue(strecke(1), 19).p),
			b = nachId(baue(strecke(1.02), 19).p);
		let gemeinsam = 0;
		for (const id of a.keys()) if (b.has(id)) gemeinsam++;
		expect(gemeinsam / a.size).toBeGreaterThan(0.97);
	});
	test('the plan stays within the budget of one frame', () => {
		const p = turmpuffer();
		for (let i = 0; i < 20; i++) baue(strecke(i * 0.3), 19, p);
		const start = performance.now();
		for (let i = 0; i < 100; i++) baue(strecke((i * 0.07) % 7), 19, p);
		expect((performance.now() - start) / 100).toBeLessThan(4);
	});
});

describe('L14 position layer and ports', () => {
	test('the rest position is the identity', () => {
		const p = verformen([3, -2, 11], ruhe(40));
		expect(p[0]).toBeCloseTo(3, 9);
		expect(p[1]).toBeCloseTo(-2, 9);
		expect(p[2]).toBeCloseTo(11, 9);
	});
	test('rounding puts the square corner on the circle, twist preserves the radius', () => {
		const rund = verformen([5, 5, 10], { ...ruhe(40), rund: 1 });
		expect(Math.hypot(rund[0], rund[1])).toBeCloseTo(5, 9);
		const seite = verformen([5, 0, 10], { ...ruhe(40), rund: 1 });
		expect(seite[0]).toBeCloseTo(5, 9);
		const gedreht = verformen([5, 2, 20], { ...ruhe(40), drall: 2 });
		expect(Math.hypot(gedreht[0], gedreht[1])).toBeCloseTo(Math.hypot(5, 2), 9);
		expect(gedreht[2]).toBe(20);
	});
	test('bending holds the foot fixed, preserves the axis length and is continuous at zero', () => {
		const lage = { ...ruhe(40), biegung: 0.9 };
		expect(verformen([0, 0, 0], lage)).toEqual([0, 0, 0]);
		let lang = 0,
			vor = verformen([0, 0, 0], lage);
		for (let z = 0.1; z <= 40.0001; z += 0.1) {
			const p = verformen([0, 0, z], lage);
			lang += Math.hypot(p[0] - vor[0], p[1] - vor[1], p[2] - vor[2]);
			vor = p;
		}
		expect(lang).toBeCloseTo(40, 2);
		const fast = verformen([2, 1, 30], { ...ruhe(40), biegung: 1e-7 });
		expect(fast[0]).toBeCloseTo(2, 4);
		expect(fast[2]).toBeCloseTo(30, 4);
	});
	test('arrangements are deterministic, bridges connect the ports of all pairs', () => {
		const g = strecke(2);
		expect(aufstellen('solo', g, 19, 2)).toHaveLength(1);
		expect(aufstellen('reihe', g, 19, 2)).toHaveLength(5);
		const trio = aufstellen('trio', g, 19, 2);
		expect(trio).toEqual(aufstellen('trio', g, 19, 2));
		const tuerme = trio.map((stand) => {
			const { t } = baue(stand.genom, stand.saat);
			return { stand, lage: t.lage, mikrokosmen: t.mikrokosmen };
		});
		const a = puffer(256),
			b = puffer(256);
		bruecken(tuerme, pal, a);
		bruecken(tuerme, pal, b);
		// Three pairs, each with 14 deck parts and four cables; nothing follows the position layer (world).
		expect(a.anzahl).toBe(3 * 18);
		expect(zeilen(a).every((v, i) => Object.is(v, b.daten[i]))).toBe(true);
		for (let o = 0; o < a.anzahl * SCHRITT; o += SCHRITT) {
			expect(a.daten[o + FELD.traeger]).toBe(0);
			expect(a.daten[o + FELD.muster]).toBe(MUSTER.keins);
		}
		// The deck is gapless: every part starts where the previous one ends (distance < 2 × half length).
		for (let i = 1; i < 14; i++) {
			const p = a.daten.subarray((i - 1) * SCHRITT, i * SCHRITT),
				q = a.daten.subarray(i * SCHRITT, (i + 1) * SCHRITT);
			expect(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2])).toBeLessThan(
				p[FELD.halb + 1] + q[FELD.halb + 1]
			);
		}
	});
});
