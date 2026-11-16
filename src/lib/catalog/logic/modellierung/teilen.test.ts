// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { teile } from './split';
import { teilenBeispiel as B } from '../../data/wachstum';

describe('Teaching example splitting', () => {
	const bei = (tiefe: number, t: number) =>
		teile({ saat: B.saat, tiefe, t, zugangsregel: true, front: B.front });
	test('every level at most doubles and keeps 6 m of frontage on the alley', () => {
		let vorher = 1;
		for (const tiefe of B.tiefen) {
			const r = bei(tiefe, 0.5);
			expect(r.blaetter.length).toBeGreaterThanOrEqual(vorher);
			expect(r.blaetter.length).toBeLessThanOrEqual(2 ** tiefe);
			for (const b of r.blaetter) expect(b.front).toBeGreaterThanOrEqual(B.front);
			vorher = r.blaetter.length;
		}
	});
	test('dimensions flow, count and names stay', () => {
		const tiefe = B.tiefen[B.tiefen.length - 1];
		const namen = bei(tiefe, B.fliessen[0]).blaetter.map((b) => b.id);
		for (let i = 0; i <= 30; i++) {
			const t = B.fliessen[0] + ((B.fliessen[1] - B.fliessen[0]) * i) / 30;
			expect(bei(tiefe, t).blaetter.map((b) => b.id)).toEqual(namen);
		}
		expect(bei(tiefe, B.fliessen[0]).blaetter[0].polygon).not.toEqual(
			bei(tiefe, B.fliessen[1]).blaetter[0].polygon
		);
	});
});
