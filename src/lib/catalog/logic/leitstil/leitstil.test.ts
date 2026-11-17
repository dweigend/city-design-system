import { describe, test, expect } from 'bun:test';
import {
	stilFuer,
	pruefeStil,
	pruefeSzene,
	strichbreite,
	bestandSegmente,
	raumStufe,
	bodenStufe
} from './index';
import { ZOOM, MODI, SITUATIONEN } from '../../data/leitstil';
import { pruefszene } from '../../data/leitstilPruefszene';

const haus = { zoom: 'haus', modus: 'ansehen', situation: 'normal', thema: 'hell' } as const;
test('people floor lighter than the active people footbridge in both themes', () => {
	for (const thema of ['hell', 'dunkel'] as const)
		for (const [modus, boden, steg] of [
			['ansehen', 2, 4],
			['bauen', 1, 2],
			['wege', 2, 4],
			['versorgung', 1, 1]
		] as const) {
			const s = stilFuer({ ...haus, modus, thema });
			expect(s.rollen.weg.strom).toBe('people');
			expect([bodenStufe(s, 'people'), s.rollen.weg.stufe]).toEqual([boden, steg]);
		}
});
describe('A1 accepted examples', () => {
	test('E1 view building', () => {
		const s = stilFuer(haus);
		expect([s.rollen.raum.stufe, s.kernStufe, s.rollen.weg.stufe]).toEqual([3, 4, 4]);
		expect(s.rollen.huelle.token).toBe('modellweiss');
		expect(s.signalZiele).toEqual([]);
		expect(s.kamera.pxProM).toBe(21);
		expect(s.kamera.azimutRad).toBe((32 * Math.PI) / 180);
		expect(s.kamera.hoeheRad).toBe((26 * Math.PI) / 180);
	});
	test('E2 build building', () => {
		const s = stilFuer({ ...haus, modus: 'bauen' });
		expect(s.signalZiele).toEqual(['baustelle']);
		expect(s.signalArt).toBe('linie');
		expect(s.rollen.auswahl.sichtbar).toBe(false);
		expect(s.rollen.raum.stufe).toBe(1);
		expect(s.rollen.weg.stufe).toBe(2);
		expect(s.rollen.geplant.gestrichelt).toBe(true);
	});
	test('E3 analyze building', () => {
		const s = stilFuer({ ...haus, modus: 'analysieren' });
		expect(s.rollen.raum.sichtbar).toBe(false);
		expect(s.traegerRolle).toBe('analyse');
		expect(s.legende).toBe(true);
		expect(s.rollen.huelle).toEqual(stilFuer(haus).rollen.huelle);
		expect(s.rollen.bestand).toEqual(stilFuer(haus).rollen.bestand);
	});
	test('E4 all 240 contexts / invariants / purity', () => {
		for (const zoom of ZOOM)
			for (const modus of MODI)
				for (const situation of SITUATIONEN)
					for (const thema of ['hell', 'dunkel'] as const) {
						const k = { zoom, modus, situation, thema };
						const s = stilFuer(k);
						expect(pruefeStil(s, k)).toEqual([]);
						expect(pruefeSzene(pruefszene, s)).toEqual([]);
						expect(s.kamera.azimutRad).toBe(stilFuer(haus).kamera.azimutRad);
						expect(s.rollen.huelle.strom).toBeUndefined();
						expect(stilFuer(k)).toEqual(s);
					}
	});
	test('E5 three targeted violations in contract order', () => {
		const s = stilFuer(haus);
		s.rollen.huelle.strom = 'people';
		s.signalZiele = ['auswahl', 'baustelle'];
		s.rollen.bestand.strichPx = 1.6;
		expect(pruefeStil(s, haus).map((v) => v.id)).toEqual(['INV-04', 'INV-08', 'INV-03']);
	});
});
test('structure: monotonic, 1.5 px lower bound, reject invalid dimensions', () => {
	let vorher = 0;
	for (const d of [0, 0.001, 0.01, 0.1, 1]) {
		const w = strichbreite(d, 21);
		expect(w).toBeGreaterThanOrEqual(1.5);
		expect(w).toBeGreaterThanOrEqual(vorher);
		vorher = w;
	}
	expect(() => strichbreite(-1, 21)).toThrow();
	expect(() => strichbreite(1, NaN)).toThrow();
});
test('existing stock: deterministic, cornices at 4/8 m, colorless geometry', () => {
	const b = pruefszene.bestand[0];
	const seg = bestandSegmente(b);
	expect(seg).toEqual(bestandSegmente(b));
	for (const z of [4, 8])
		expect(seg.some((s) => s.art === 'gesims' && s.a[2] === z && s.b[2] === z)).toBe(true);
	expect(JSON.stringify(seg)).not.toMatch(/farbe|strom|token/);
});
test('negative samples for all further invariants', () => {
	const cases = [
		[
			'INV-01',
			(s: ReturnType<typeof stilFuer>) => {
				s.rollen.weg.token = '--cat-health';
			}
		],
		[
			'INV-02',
			(s: ReturnType<typeof stilFuer>) => {
				s.rollen.bestand.kontrast = 100;
			}
		],
		[
			'INV-05',
			(s: ReturnType<typeof stilFuer>) => {
				s.rollen.bestand.schatten = true;
			}
		],
		[
			'INV-06',
			(s: ReturnType<typeof stilFuer>) => {
				s.kamera.azimutRad = 0;
			}
		],
		[
			'INV-07',
			(s: ReturnType<typeof stilFuer>) => {
				s.massstabsbalken = false;
			}
		],
		[
			'INV-09',
			(s: ReturnType<typeof stilFuer>) => {
				s.rollen.raum.kontrast = 0;
			}
		],
		[
			'INV-10',
			(s: ReturnType<typeof stilFuer>) => {
				s.kernStufe = 1;
			}
		]
	] as const;
	for (const [id, mutate] of cases) {
		const s = stilFuer(haus);
		mutate(s);
		expect(pruefeStil(s, haus).some((v) => v.id === id)).toBe(true);
	}
});

// Regression: focus raises the zoom base, not the already lowered context step.
test('flow focus reaches step 4 at building zoom, 3 at district zoom; another flow stays 1', () => {
	for (const [zoom, stufe] of [
		['haus', 4],
		['quartier', 3]
	] as const) {
		const s = stilFuer({ ...haus, zoom, modus: 'wege' });
		expect(raumStufe(s, 'people')).toBe(stufe);
		expect(raumStufe(s, 'water')).toBe(1);
	}
});
test('test scene: bearings, upper chord, hangers and footbridge outside the existing stock', () => {
	for (const x of [-8, 8])
		expect(pruefszene.staebe.some((s) => [s.a, s.b].some((p) => p[0] === x && p[2] === 8))).toBe(
			true
		);
	expect(pruefszene.staebe.some((s) => s.a[2] === 10.12 && s.b[2] === 10.12)).toBe(true);
	expect(pruefszene.staebe.filter((s) => s.a[2] === 8 && s.b[2] === 4)).toHaveLength(4);
	for (const weg of pruefszene.wege)
		for (const p of weg.punkte)
			for (const b of pruefszene.bestand)
				expect(
					p[0] + weg.breite / 2 <= b.min[0] ||
						p[0] - weg.breite / 2 >= b.max[0] ||
						p[1] + weg.breite / 2 <= b.min[1] ||
						p[1] - weg.breite / 2 >= b.max[1]
				).toBe(true);
});
