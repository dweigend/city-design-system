import { expect, test } from 'bun:test';
import { materialAusfuehrungen } from '../../data/materialAusfuehrung';
import { ausfuehrungenVon } from './ausfuehrung';
import { voreinstellung } from './rezept';
import { probeSzene } from './studien';

test('ten appended reference finishes are unique and leave the starting finish in place', () => {
	const reference = materialAusfuehrungen.slice(-10);
	expect(new Set(reference.map((a) => a.id)).size).toBe(10);
	for (const a of reference) {
		const finishes = ausfuehrungenVon(a.familie);
		expect(finishes[0].id).not.toBe(a.id);
		expect(finishes).toContainEqual(a);
	}
	expect(new Set(materialAusfuehrungen.map((a) => a.id)).size).toBe(materialAusfuehrungen.length);
});

test('reference models fit their own finish and foreign or absent choices keep the native model', () => {
	const choices = [
		['metall', 'metall-messing', 'brass-facets'],
		['kunststoff', 'kunststoff-gerippt', 'corrugated-panel'],
		['glas', 'glas-photovoltaik', 'glazed-solar-array'],
		['membran', 'membran-flor', 'pile-covered-sleeve']
	] as const;
	for (const [fam, id, name] of choices) {
		const wahl = voreinstellung(fam, 'neutral');
		const model = probeSzene(fam, wahl, id);
		const part = model.find((s) => s.id === name);
		expect(part?.ausfuehrung).toBe(id);
		expect(part?.rezept.familie).toBe(fam);
		expect(probeSzene(fam, wahl, id)).toEqual(model);
	}
	const wahl = voreinstellung('glas', 'neutral');
	expect(probeSzene('glas', wahl, 'metall-messing')).toEqual(probeSzene('glas', wahl));
});
