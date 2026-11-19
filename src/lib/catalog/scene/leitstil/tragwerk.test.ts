import { expect, test } from 'bun:test';
import { stilFuer, strichbreite, type Stab } from '../../logic/leitstil';
import { stabStriche } from './tragwerk';

test('Normal view: compression and tension solid in ink, width by diameter only', () => {
	for (const thema of ['hell', 'dunkel'] as const)
		for (const skala of [0.39, 1, 1.44])
			for (const durchmesser of [0, 0.01, 0.2, 1]) {
				const stil = stilFuer({ zoom: 'haus', modus: 'ansehen', situation: 'normal', thema });
				for (const art of ['druck', 'zug'] as const) {
					const stab: Stab = { a: [0, 0, 0], b: [1, 0, 0], durchmesser, art };
					const lagen = stabStriche(stab, stil, skala);
					expect(lagen.at(-1)).toEqual({ ton: 'ink', breite: strichbreite(durchmesser, 21) });
					expect(lagen.map((l) => l.ton)).toEqual(thema === 'dunkel' ? ['paper', 'ink'] : ['ink']);
				}
			}
});

test('Analysis: only compression gets a paper core; legibility and stale analysis remain', () => {
	for (const thema of ['hell', 'dunkel'] as const)
		for (const skala of [0.39, 1.44]) {
			const stil = stilFuer({ zoom: 'haus', modus: 'analysieren', situation: 'rechnen', thema });
			const stab: Stab = { a: [0, 0, 0], b: [1, 0, 0], durchmesser: 0.01, art: 'druck' };
			const druck = stabStriche(stab, stil, skala);
			const kern = druck.at(-1),
				aussen = druck.find((l) => l.ton === 'ink');
			if (!kern || !aussen) throw new Error('Compression needs an outer line and a core.');
			expect(kern.ton).toBe('paper');
			expect(kern.breite * skala).toBeGreaterThanOrEqual(1);
			expect(aussen.breite * skala).toBeGreaterThanOrEqual(2.5);
			expect(druck.find((l) => l.ton === 'analyse')?.veraltet).toBe(true);
			expect(stabStriche({ ...stab, art: 'zug' }, stil, skala).at(-1)?.ton).toBe('analyse');
		}
});
