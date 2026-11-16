// @ts-expect-error Bun provides bun:test at runtime; the project has no @types/bun.
import { describe, expect, test } from 'bun:test';
import { vorberechnet } from '../../logic/traeger/hausAuftrag';
import { hausLeitstil, hatHausLeitstil } from './haus';
import { neuBauen } from '../../logic/haus-tragwerk';

const ergebnis = vorberechnet({ familie: 'raumfachwerk', saat: 42, stufe: 'abtrag' });
if (!ergebnis?.haus.statik) throw new Error('Computed A2 fixture is missing.');
const haus = ergebnis.haus,
	statik = ergebnis.haus.statik;
describe('A2: computed house → house style', () => {
	test('E1: strut order, positions, diameters, and compression flag are preserved', () => {
		const bild = hausLeitstil(haus, 'belegt');
		const ort = new Map(haus.traeger.knoten.map((n) => [n.id, n.p]));
		const erwartet = haus.traeger.kanten.filter((k) => statik.staebe[k.id]);
		expect(bild.staebe.slice(0, erwartet.length)).toEqual(
			erwartet.map((k) => ({
				a: ort.get(k.a),
				b: ort.get(k.b),
				durchmesser: statik.staebe[k.id].durchmesserM,
				art: statik.staebe[k.id].druck ? 'druck' : 'zug'
			}))
		);
		expect(bild.staebe.length).toBe(erwartet.length + statik.haenger.length);
	});
	test('E2: a removed capsule drops hangers and use; the carrier remains', () => {
		const bild = hausLeitstil({ ...haus, einbauten: [] }, 'belegt');
		expect(bild.koerper).toHaveLength(0);
		expect(bild.staebe.length).toBe(haus.traeger.kanten.filter((k) => statik.staebe[k.id]).length);
	});
	test('E3: structural frame shows no volumes or capsule struts; envelope shows no use color', () => {
		const geruest = hausLeitstil(haus, 'geruest');
		expect(geruest.koerper).toHaveLength(0);
		expect(geruest.staebe).toEqual(hausLeitstil({ ...haus, einbauten: [] }, 'geruest').staebe);
		expect(
			hausLeitstil(haus, 'huelle').koerper.every((k) => k.rolle === 'huelle' && !k.strom)
		).toBe(true);
	});
	test('E4: rounded plan is preserved; color sits inside', () => {
		const bild = hausLeitstil(haus, 'belegt');
		const raum = haus.anschluesse.find((a) => a.art === 'raum');
		if (!raum) throw new Error('Room fixture is missing.');
		expect(bild.koerper.find((k) => k.teil === 'boden')?.polygon).toEqual(raum.polygon);
		expect(bild.koerper.filter((k) => k.rolle === 'huelle').every((k) => !k.strom)).toBe(true);
		expect(bild.wege[0].punkte[1]).toEqual(haus.eingang.p);
	});
	test('E5: projection is repeatable and does not change the plan', () => {
		const vorher = JSON.stringify(haus);
		expect(hausLeitstil(haus, 'belegt')).toEqual(hausLeitstil(haus, 'belegt'));
		expect(JSON.stringify(haus)).toBe(vorher);
	});
});

describe('House-style precondition for stage selection', () => {
	test('Full candidate grid has no structural analysis and must take the general scene path', () => {
		const block = neuBauen('raumfachwerk', 42, {}, 'block');
		expect(block.statik).toBeUndefined();
		expect(hatHausLeitstil(block)).toBe(false);
		expect(() => hausLeitstil(block, 'belegt')).toThrow(RangeError);
		expect(hatHausLeitstil(haus)).toBe(true);
	});
	test('missing existing stock and other families stay outside the adapter', () => {
		expect(hatHausLeitstil({ ...haus, bestand: undefined })).toBe(false);
		expect(hatHausLeitstil({ ...haus, familie: 'wabe' })).toBe(false);
	});
});
