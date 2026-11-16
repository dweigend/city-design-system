// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { kontrollpunkte, treppenbreite, TREPPE } from '../modellierung/cage';
import {
	auszug,
	schichtVon,
	stapelBild,
	stapelDauern,
	stapelLage,
	stapelTeile,
	stapelVersatz
} from './stapel';
import { ACHSEN, begrenze, startVerformung, zulaessig } from './verformung';
import { REGELN, komposition, startKomposition } from './komposition';
import { schrittBeginn } from './loops';

describe('What bears, stays (examples)', () => {
	const teile = stapelTeile();

	test('the same seed yields the same parts; every layer is present', () => {
		expect(stapelTeile()).toEqual(teile);
		const schichten = new Set(teile.map(schichtVon));
		expect([...schichten].sort()).toEqual(['bestand', 'einschub', 'geruest', 'zutat']);
	});

	test('first only existing stock, then structural frame, then plug-in modules', () => {
		const bei = (i: number) => stapelLage(schrittBeginn(stapelDauern, i) + 0.01).sichtbar;
		expect(bei(0)).toEqual(['bestand']);
		expect(bei(1)).toEqual(['bestand', 'geruest']);
		expect(bei(2)).toContain('einschub');
	});

	test('conversion recolors only plug-in modules; existing stock and frame stay the same', () => {
		const alle = ['bestand', 'geruest', 'einschub', 'zutat'] as const;
		const vorher = stapelBild(teile, alle, false),
			nachher = stapelBild(teile, alle, true);
		expect(nachher.map((p) => p.id)).toEqual(vorher.map((p) => p.id));
		vorher.forEach((p, i) => {
			if (schichtVon(p) === 'einschub') expect(nachher[i].token).not.toBe(p.token);
			else expect(nachher[i]).toEqual(p);
		});
	});

	test('drawers slide only forward or back, never into the old buildings', () => {
		const lage = stapelLage(schrittBeginn(stapelDauern, 3) + 2.5);
		expect(lage.schritt).toBe('heraus');
		const versatz = stapelVersatz(teile, lage);
		for (const p of teile.filter((p) => schichtVon(p) === 'einschub')) {
			expect(auszug(p)[0]).toBe(0);
			const [x, y] = versatz.get(`einschub:${p.id}`) ?? [0, 0, 0];
			expect(x).toBe(0);
			expect(Math.abs(y)).toBeGreaterThan(3);
		}
	});
});

describe('Deformation leeway (examples)', () => {
	test('the starting position is valid', () => {
		expect(zulaessig(startVerformung)).toBe(true);
	});

	test('tilt alone may go to the end of the slider', () => {
		const o = { ...startVerformung, verjuengung: 0, drehung: 0 };
		expect(begrenze(o, 'scherung', ACHSEN.scherung.max)).toBe(ACHSEN.scherung.max);
	});

	test('taper ends at the boundary: the stair keeps 1.5 m, a few percent further it no longer does', () => {
		const o = { ...startVerformung, verjuengung: 0, drehung: 0 };
		const rand = begrenze(o, 'verjuengung', ACHSEN.verjuengung.max);
		expect(rand).toBeGreaterThan(0.01);
		expect(rand).toBeLessThan(ACHSEN.verjuengung.max);
		const breite = treppenbreite(kontrollpunkte({ ...o, verjuengung: rand }));
		expect(breite).toBeGreaterThanOrEqual(TREPPE.soll - 1e-9);
		expect(zulaessig({ ...o, verjuengung: rand + 0.01 })).toBe(false);
	});

	test('a valid target is taken over unchanged', () => {
		expect(begrenze(startVerformung, 'drehung', 0.05)).toBe(0.05);
	});
});

describe('Composition (examples)', () => {
	test('every rule places forms; same choice, same primitives', () => {
		for (const regel of REGELN) {
			const w = { ...startKomposition, regel };
			const a = komposition(w);
			expect(a.length).toBeGreaterThan(0);
			expect(komposition(w)).toEqual(a);
		}
	});

	test('courtyard: the edge is built up, trees stand inside', () => {
		const ids = komposition({ ...startKomposition, regel: 'hof' }).map((p) => p.id);
		expect(ids.some((id) => id.startsWith('hof-'))).toBe(true);
		expect(ids.some((id) => id.startsWith('hofgarten-'))).toBe(true);
	});

	test('landmark: exactly one cell tall, the surroundings low', () => {
		const p = komposition({ ...startKomposition, regel: 'landmarke' });
		const mark = p.filter((x) => x.id.startsWith('landmarke-'));
		expect(new Set(mark.map((x) => x.id.split('-')[1])).size).toBe(1);
		expect(p.some((x) => x.id.startsWith('umgebung-'))).toBe(true);
	});

	test('structural frame: more occupancy, more plug-in modules', () => {
		const n = (belegung: number) =>
			komposition({ ...startKomposition, regel: 'geruest', belegung }).length;
		expect(n(1)).toBeGreaterThan(n(0));
	});
});
