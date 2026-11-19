import { expect, test } from 'bun:test';
import type { AusfuehrungId } from '../../data/materialAusfuehrung';
import type { FamilieId } from '../../data/materialSeite';
import { oberflaechenWerte } from './ausfuehrung';
import { rezept, voreinstellung } from './rezept';

const festeFinishes = [
	['beton', 'beton-geadert', 'Veined mineral'],
	['kunststoff', 'kunststoff-guss', 'Poured enamel'],
	['membran', 'membran-opal', 'Opal film'],
	['metall', 'metall-signalrot', 'Signal red'],
	['metall', 'metall-kalkgruen', 'Lime green']
] as const satisfies readonly (readonly [FamilieId, AusfuehrungId, string])[];

for (const [familie, id, name] of festeFinishes) {
	test(`${name} has fixed studio coverage and color without changing the diagram recipe`, () => {
		const wahl = voreinstellung(familie, 'people');
		const r = rezept(familie, { ...wahl, deckkraft: 'trace' });
		const vorher = structuredClone(r);
		const w = oberflaechenWerte(r, id);
		expect(w).toMatchObject({ id, name, deckkraft: 1, transmission: 0, pigment: 0 });
		expect(r).toEqual(vorher);
		expect(oberflaechenWerte(rezept(familie), id).grundton).toBe(w.grundton);
	});
}
