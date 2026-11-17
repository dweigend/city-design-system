import { describe, expect, test } from 'bun:test';
import { erreichbar, standardTore, wfc, type WfcErgebnis } from './wfc';

const bits = [1, 2, 4, 8];
const gegen = [4, 8, 1, 2];
const seiten = ['nord', 'ost', 'sued', 'west'] as const;

describe('Wave Function Collapse', () => {
	test('the same seed reproduces all data; another seed changes the tiles', () => {
		const a = wfc({ saat: 1 });
		expect(a.status).toBe('fertig');
		expect(JSON.stringify(a)).toBe(JSON.stringify(wfc({ saat: 1 })));
		expect(wfc({ saat: 2 }).kacheln).not.toEqual(a.kacheln);
	});

	test('inner edges match; on the outside only the gates open', () => {
		for (let saat = 1; saat <= 40; saat++) {
			const e = wfc({ saat });
			expect(e.status).toBe('fertig');
			const tore = standardTore(e.breite, e.hoehe);
			e.kacheln.forEach((k, i) => {
				const x = i % e.breite,
					y = Math.floor(i / e.breite);
				const nachbarn = [
					y > 0 ? i - e.breite : -1,
					x < e.breite - 1 ? i + 1 : -1,
					y < e.hoehe - 1 ? i + e.breite : -1,
					x > 0 ? i - 1 : -1
				];
				nachbarn.forEach((j, s) => {
					const offen = (k & bits[s]) !== 0;
					expect(offen).toBe(
						j < 0
							? tore.some((t) => t.zelle === i && t.seite === seiten[s])
							: (e.kacheln[j] & gegen[s]) !== 0
					);
				});
			});
		}
	});

	test('buildings also close their neighboring edges', () => {
		const e = wfc({ saat: 1, haeuser: [23, 24, 46] });
		expect(e.status).toBe('fertig');
		for (const i of [23, 24, 46]) {
			expect(e.kacheln[i]).toBe(16);
			[i - 10, i + 1, i + 10, i - 1].forEach((j, s) => {
				expect(e.kacheln[j] & gegen[s]).toBe(0);
			});
		}
	});

	test('a gate in a building contradicts after exactly 30 attempts', () => {
		const e = wfc({ saat: 1, haeuser: [30] });
		expect(e.status).toBe('widerspruch');
		expect(e.versuche).toBe(30);
		expect(e.schritte).toEqual([]);
		expect(e.kacheln).toContain(-1);
	});

	test('an isolated loop is not reachable from the gates', () => {
		const e: WfcErgebnis = {
			breite: 5,
			hoehe: 3,
			kacheln: [10, 10, 10, 10, 10, 0, 0, 0, 6, 12, 0, 0, 0, 3, 9],
			start: [],
			schritte: [],
			status: 'fertig',
			versuche: 1
		};
		expect([...erreichbar(e, [{ zelle: 0, seite: 'west' }])]).toEqual([0, 1, 2, 3, 4]);
		const beispiele = Array.from({ length: 40 }, (_, i) =>
			wfc({ saat: i + 1, haeuser: [23, 24, 46] })
		);
		expect(
			beispiele.some(
				(e) =>
					e.status === 'fertig' &&
					e.kacheln.some(
						(k, i) => k > 0 && k < 16 && !erreichbar(e, standardTore(e.breite, e.hoehe)).has(i)
					)
			)
		).toBe(true);
	});

	test('history contains exactly the explicit decisions and ends with singletons', () => {
		const e = wfc({ saat: 1 });
		let vorher = e.start;
		for (const schritt of e.schritte) {
			expect(vorher[schritt.zelle]).toBeGreaterThan(1);
			expect(schritt.kachel).toBe(e.kacheln[schritt.zelle]);
			expect(schritt.optionen[schritt.zelle]).toBe(1);
			expect(schritt.optionen.every((n, i) => n > 0 && n <= vorher[i])).toBe(true);
			vorher = schritt.optionen;
		}
		expect(e.schritte.length).toBeGreaterThan(0);
		expect(new Set(e.schritte.map((s) => s.zelle)).size).toBe(e.schritte.length);
		expect(vorher.every((n) => n === 1)).toBe(true);
	});
});
