/**
 * Development mode of the structural simulation: computes the expensive form finding ahead of
 * time and stores the results as data. Run with `bun scripts/statik-vorberechnen.ts` after any
 * change of the generator, then format the file with prettier. `hausAuftrag.test.ts` fails while
 * the stored file is stale.
 */
import { writeFileSync } from 'node:fs';
import {
	VORBERECHNETE_AUFTRAEGE,
	hausSchluessel,
	rechneHaus
} from '../src/lib/catalog/logic/traeger/hausAuftrag';

const ziel = new URL('../src/lib/catalog/data/vorberechnet/haengehaus.json', import.meta.url);
const ergebnisse: Record<string, unknown> = {};
for (const auftrag of VORBERECHNETE_AUFTRAEGE) {
	const start = performance.now();
	const ergebnis = rechneHaus(auftrag);
	ergebnisse[hausSchluessel(auftrag)] = ergebnis;
	console.log(
		`${hausSchluessel(auftrag)} ${JSON.stringify(auftrag)}: ${ergebnis.knoten} nodes, ${ergebnis.staebe} struts, ${(performance.now() - start).toFixed(0)} ms`
	);
}
writeFileSync(ziel, JSON.stringify(ergebnisse) + '\n');
