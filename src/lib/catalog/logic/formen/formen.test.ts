// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { cellShapes, testCells } from '../parametrik/formen/zellen';
import { funktion } from '../parametrik/eckraster/funktion';
import {
	PHASEN,
	ZONEN,
	bisPhase,
	erlaubt,
	mitFunktion,
	startWahl,
	turm,
	zonenFamilien,
	zonenGruppen,
	type TurmWahl
} from './turm';
import {
	eckSchritte,
	ebenen,
	gleichesModul,
	schrittBeginn,
	takt,
	wegDauern,
	wegLauf
} from './loops';
import { eckAusId, eckBild, eckId, wegTurm } from './bilder';

const quadrat = { polygon: testCells.square.polygon };
function muss<T>(wert: T | undefined): T {
	if (wert === undefined) throw new Error('missing');
	return wert;
}

describe('Tower on the cell (examples)', () => {
	test('the same choice and seed yield the same primitives in the same order', () => {
		expect(turm(startWahl, quadrat)).toEqual(turm(structuredClone(startWahl), quadrat));
	});

	test('parts come in build order, ids are unique and carry their phase', () => {
		const t = turm(startWahl, quadrat);
		expect(t.teile.map((x) => x.phase)).toEqual(PHASEN);
		const ids = t.teile.flatMap((x) => x.primitives.map((p) => p.id));
		expect(new Set(ids).size).toBe(ids.length);
		for (const teil of t.teile.slice(1))
			for (const p of teil.primitives) expect(p.id.startsWith(`${teil.phase}:`)).toBe(true);
	});

	test('a crown on only one floor does not bear and is drawn as glass', () => {
		const t = turm({ ...startWahl, geschosse: 1 }, quadrat);
		expect(t.kopfGueltig).toBe(false);
		const kopf = muss(t.teile.find((x) => x.phase === 'kopf')).primitives;
		expect(kopf.length).toBeGreaterThan(0);
		expect(kopf.every((p) => p.glass)).toBe(true);
		expect(turm(startWahl, quadrat).kopfGueltig).toBe(true);
	});

	test('existing stock in the plinth stays existing stock; function colors the stack, never the plinth', () => {
		const t = turm(startWahl, quadrat);
		const sockel = muss(t.teile.find((x) => x.phase === 'sockel')).primitives;
		expect(sockel.every((p) => p.role === 'bestand')).toBe(true);
		const stapel = muss(t.teile.find((x) => x.phase === 'stapel')).primitives;
		expect(stapel.some((p) => p.token === funktion('wohnen').token)).toBe(true);
	});

	test('every allowed family fills every test cell in its zone', () => {
		for (const zone of ZONEN)
			for (const gruppe of zonenGruppen[zone])
				for (const familie of zonenFamilien(zone, gruppe))
					for (const shape of cellShapes) {
						const wahl: TurmWahl = { ...startWahl, [zone]: { familie } };
						const teil = muss(
							turm(wahl, { polygon: testCells[shape].polygon }).teile.find((x) => x.phase === zone)
						);
						expect(teil.primitives.length).toBeGreaterThan(0);
					}
	});

	test('zones are separate: no crown at the bottom, existing stock only in the plinth', () => {
		expect(zonenGruppen.sockel).not.toContain('kopf');
		expect(zonenGruppen.stapel).not.toContain('bestand');
		expect(zonenGruppen.kopf).not.toContain('bestand');
		expect(erlaubt('sockel', 'kopf-kuppel')).toBe(false);
		expect(erlaubt('kopf', 'kopf-kuppel')).toBe(true);
	});

	test('choosing a function sets the crown; other zones stay untouched', () => {
		const w = mitFunktion(startWahl, 'energie');
		expect(w.kopf.familie).toBe(funktion('energie').kopf);
		const a = turm(startWahl, quadrat),
			b = turm({ ...startWahl, kopf: { familie: 'kopf-kuppel' } }, quadrat);
		expect(bisPhase(b, 'stapel')).toEqual(bisPhase(a, 'stapel'));
	});
});

describe('Explainer loops (examples)', () => {
	test('beat: step boundaries and repetition', () => {
		expect(takt([1, 2], 0)).toEqual({ index: 0, u: 0, runde: 0 });
		expect(takt([1, 2], 1)).toEqual({ index: 1, u: 0, runde: 0 });
		expect(takt([1, 2], 3.5).index).toBe(0);
		expect(takt([1, 2], 3.5).runde).toBe(1);
		expect(schrittBeginn([1, 2, 3], 2)).toBe(3);
	});

	test('corners: rotated is the same module, click ids can be resolved', () => {
		const wand = muss(eckSchritte.find((s) => s.id === 'wand')).mask;
		const gedreht = muss(eckSchritte.find((s) => s.id === 'gedreht')).mask;
		expect(gleichesModul(wand, gedreht)).toBe(true);
		expect(gleichesModul(0x01, 0x03)).toBe(false);
		expect(eckAusId(eckId(5))).toBe(5);
		const bild = eckBild(0x33, 'quadrat');
		expect(bild.filter((p) => p.id.startsWith('ecke:'))).toHaveLength(8);
		expect(
			eckBild(0, 'quadrat').some((p) => !p.id.startsWith('ecke:') && !p.id.startsWith('kaefig'))
		).toBe(false);
	});

	test('path: the person climbs level by level, color follows arrival', () => {
		let z = -1,
			erreicht = 0;
		const total = wegDauern.reduce((a, b) => a + b, 0);
		for (let t = 0; t < total - 0.01; t += 0.05) {
			const b = wegLauf(t);
			expect(b.mensch[2]).toBeGreaterThanOrEqual(z - 1e-9);
			expect(b.erreicht).toBeGreaterThanOrEqual(erreicht);
			z = b.mensch[2];
			erreicht = b.erreicht;
		}
		expect(erreicht).toBe(ebenen.length);
		expect(wegLauf(total - 0.1).schritt).toBe('garten');
		const farbig = wegTurm(2).filter((p) => p.id.startsWith('ebene:') && p.token !== '--paper');
		expect(farbig.map((p) => p.id)).toEqual(['ebene:markt', 'ebene:werkstatt']);
	});
});
