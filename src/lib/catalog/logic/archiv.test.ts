// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import type { ArchivItem, Herkunft } from '../data/archiv';
import { verfuegbareHerkunft } from './archiv';

function archivItem(herkunft: Herkunft, nr = '01'): ArchivItem {
	return {
		key: `${herkunft}-${nr}`,
		nr,
		herkunft,
		datei: `${herkunft}-${nr}.png`,
		titel: `${herkunft} ${nr}`,
		listen: [],
		begriffe: { ansicht: [], stil: [], form: [], material: [], oberflaeche: [] }
	};
}

describe('verfuegbareHerkunft', () => {
	test('hides all origin options when the full collection is empty', () => {
		expect(verfuegbareHerkunft([])).toEqual([]);
	});

	test('shows only origin options that have items, each option once', () => {
		expect(verfuegbareHerkunft([archivItem('roh'), archivItem('roh', '02')])).toEqual(['roh']);
	});

	test('keeps the label order regardless of the input order', () => {
		const items = [archivItem('fremd'), archivItem('ui'), archivItem('roh'), archivItem('eigen')];
		const erwartet = ['eigen', 'roh', 'ui', 'fremd'];
		expect(verfuegbareHerkunft(items)).toEqual(erwartet);
		expect(verfuegbareHerkunft([...items].reverse())).toEqual(erwartet);
	});

	test('preserves input values, order and identity and returns a detached list', () => {
		const items = [archivItem('ui'), archivItem('eigen'), archivItem('ui', '02')];
		const vorher = structuredClone(items);
		const referenzen = [...items];
		const ergebnis = verfuegbareHerkunft(items);
		ergebnis.reverse();
		ergebnis.push('fremd');

		expect(items).toEqual(vorher);
		items.forEach((item, index) => expect(item).toBe(referenzen[index]));
		expect(verfuegbareHerkunft(items)).toEqual(['eigen', 'ui']);
	});
});
