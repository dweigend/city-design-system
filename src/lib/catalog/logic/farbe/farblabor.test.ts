import { describe, expect, test } from 'bun:test';
import {
	aktiveWege,
	anteile,
	ebene,
	faerbe,
	mitModus,
	paketToken,
	startAnsicht,
	waehleStrom,
	type Ansicht
} from './farblabor';
import { flows, focusModes, MAX_FOKUS_STROEME } from '../../data/focus';
import { baueQuartier, type Teil, type Vec3 } from './quartier';
import { pakete, paketLage } from './pakete';

const ALPHA = { '--alpha-solid': 1, '--alpha-glass': 0.6, '--alpha-hull': 0.3 };
const m = baueQuartier(7);
const teil = (id: string) => {
	const t = m.teile.find((x) => x.id === id);
	if (!t) throw new Error(`Part missing: ${id}`);
	return t;
};
const sicht = (a: Partial<Ansicht>): Ansicht => ({ ...startAnsicht, ...a });

describe('Color lab', () => {
	test('example: the same seed yields the same district, another seed only another offset', () => {
		expect(baueQuartier(7)).toEqual(m);
		const b = baueQuartier(8);
		expect(b.teile.map((t) => t.id)).toEqual(m.teile.map((t) => t.id));
		expect(b.teile.some((t, i) => t.min[0] !== m.teile[i].min[0])).toBe(true);
	});

	test('example: a tank is core, so step 5; choosing step 2 overrides the meaning', () => {
		const v = mitModus(startAnsicht, 'versorgung');
		expect(faerbe(teil('modul-7'), v).fill).toBe('--cat-health-5');
		expect(faerbe(teil('modul-7'), { ...v, stufe: 2 }).fill).toBe('--cat-health-2');
		expect(faerbe(teil('solar'), v).fill).toBe('--cat-mobility');
	});

	test('example: no mode colors more than three flows; a fourth displaces the oldest', () => {
		for (const mo of focusModes) expect(mo.flows.length).toBeLessThanOrEqual(MAX_FOKUS_STROEME);
		expect(waehleStrom(['material', 'energy', 'water'], 'food')).toEqual([
			'energy',
			'water',
			'food'
		]);
		expect(waehleStrom(['water', 'energy'], 'water')).toEqual(['energy']);
		for (const mo of focusModes) {
			const farbig = new Set(
				m.teile.filter((t) => faerbe(t, mitModus(startAnsicht, mo.id)).klasse === 'funktion')
			);
			const stroeme = new Set([...farbig].map((t) => t.strom));
			expect(stroeme.size).toBeLessThanOrEqual(MAX_FOKUS_STROEME);
		}
	});

	test('a mode is an activity, not a flow: no flow name, no "cycle"', () => {
		const stromNamen = new Set(flows.map((f) => f.name));
		for (const mo of focusModes) {
			expect(stromNamen.has(mo.name)).toBe(false);
			expect(/kreislauf|cycle/i.test(mo.name)).toBe(false);
		}
	});

	test('example: Paths mode: people in focus, existing stock context, other new builds hull', () => {
		const a = mitModus(startAnsicht, 'wege');
		expect(ebene(teil('hochweg'), a)).toBe('focus');
		expect(faerbe(teil('hochweg'), a).fill).toBe('--cat-business');
		expect(faerbe(teil('b-nord'), a)).toMatchObject({ ebene: 'context', kante: '--ink-3' });
		expect(faerbe(teil('modul-7'), a)).toMatchObject({
			ebene: 'background',
			fill: '--paper',
			alpha: '--alpha-hull'
		});
		expect(faerbe(teil('geruest-0'), a).fill).toBe('--signal');
		expect(aktiveWege(m, a).map((w) => w.id)).toEqual(['gehen']);
	});

	test('example: Existing Stock mode: old building in focus with ink edge, no flow color, no packets', () => {
		const a = mitModus(startAnsicht, 'bestand');
		expect(faerbe(teil('b-west'), a)).toMatchObject({
			ebene: 'focus',
			fill: '--paper',
			kante: '--ink'
		});
		expect(m.teile.every((t) => faerbe(t, a).klasse !== 'funktion')).toBe(true);
		expect(ebene(teil('modul-0'), a)).toBe('background');
		expect(aktiveWege(m, a)).toEqual([]);
	});

	test('example: glass applies only to volumes in focus; existing stock stays matte with gray edges', () => {
		const a = { ...mitModus(startAnsicht, 'wege'), oberflaeche: 'glas' as const };
		expect(faerbe(teil('modul-4'), a)).toMatchObject({
			alpha: '--alpha-hull',
			oberflaeche: 'glas'
		});
		expect(faerbe(teil('hochweg'), a).oberflaeche).toBe('matt');
		expect(faerbe(teil('b-nord'), a)).toMatchObject({ fill: '--paper', kante: '--ink-3' });
	});

	test('example: one flow colors less than three; signal stays at 5 % at most', () => {
		const drei = anteile(m, startAnsicht, ALPHA);
		const wasser = anteile(m, sicht({ modus: 'eigen', stroeme: ['water'] }), ALPHA);
		expect(wasser.funktion).toBeLessThan(0.2);
		expect(wasser.funktion).toBeLessThan(drei.funktion);
		expect(drei.signal).toBeLessThanOrEqual(0.05);
		expect(drei.ruhig + drei.funktion + drei.signal).toBeCloseTo(1, 9);
	});

	test('coloring does not change the structure (PD-6)', () => {
		const vorher = JSON.stringify(m);
		for (const mo of focusModes)
			for (const t of m.teile)
				faerbe(t, { ...mitModus(startAnsicht, mo.id), stufe: 5, oberflaeche: 'milchig' });
		expect(JSON.stringify(m)).toBe(vorher);
	});

	test('example: the transport line is built and runs from the recyclables at the tower to the depot', () => {
		const stuecke = m.teile.filter((t) => t.id.startsWith('transport-'));
		expect(stuecke.length).toBe(4);
		for (const t of stuecke) expect([t.strom, t.art, t.rolle]).toEqual(['material', 'netz', 'neu']);
		const weg = m.wege.find((w) => w.id === 'transport');
		if (!weg) throw new Error('Path missing');
		const beruehrt = (p: Vec3, t: Teil) =>
			p.every((v, k) => v >= t.min[k] - 1e-9 && v <= t.min[k] + t.size[k] + 1e-9);
		expect(beruehrt(weg.punkte[0], teil('wertstoff'))).toBe(true);
		expect(beruehrt(weg.punkte[weg.punkte.length - 1], teil('rohstoff'))).toBe(true);
	});

	test('every built line is orthogonal: exactly one axis changes per segment', () => {
		for (const w of m.wege)
			for (let i = 1; i < w.punkte.length; i++) {
				const achsen = [0, 1, 2].filter((k) => w.punkte[i][k] !== w.punkte[i - 1][k]);
				expect([w.id, i, achsen.length]).toEqual([w.id, i, 1]);
			}
	});

	test('example: cycle: on every path every second packet runs back, in the core of its flow', () => {
		const liste = pakete(m);
		for (const w of m.wege) {
			const eigene = liste.filter((p) => p.weg.id === w.id);
			expect(eigene.some((p) => p.richtung === 1)).toBe(true);
			expect(eigene.some((p) => p.richtung === -1)).toBe(true);
		}
		expect(paketToken('material', 1)).toBe('--cat-living');
		expect(paketToken('material', -1)).toBe('--cat-living-5');
	});

	test('example: a return packet moves against the path direction', () => {
		const p = pakete(m).find((x) => x.weg.id === 'transport' && x.richtung === -1);
		if (!p) throw new Error('Return flow missing');
		const hin = { ...p, richtung: 1 as const };
		const a = paketLage(p, 0),
			b = paketLage(p, 1),
			c = paketLage(hin, 1);
		expect(a).toEqual(paketLage(hin, 0));
		// Tolerance 1e-9 m (PN): return path = outbound path mirrored.
		b.forEach((v, k) => expect(v - a[k]).toBeCloseTo(a[k] - c[k], 9));
	});
});
