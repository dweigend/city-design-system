import { strict as assert } from 'node:assert';
import { it } from 'node:test';
import { flowToken } from '../../data/focus';
import { knotenSzene, leisteSzene, rezeptSzene } from './formen';
import { materialStart, waehleMaterial, materialWerkstatt } from './werkstatt';
import { musterVersatzM } from './variation';
import { mischSzene } from './studien';
import { tslQuelle } from './tslQuelle';

it('projects a single edited wood recipe on every focused piece and all six diagram stages', () => {
	let z = waehleMaterial(materialStart(), 'familie', 'holz');
	z = waehleMaterial(z, 'finish', 'holz-gebeizt');
	z = waehleMaterial(z, 'strom', 'food');
	z = waehleMaterial(z, 'rauheit', 'grob');
	const { rezept, stuecke } = materialWerkstatt(z);
	assert.equal(rezept.farbe.token, flowToken.food);
	for (const s of stuecke.filter((s) => s.teil.rolle === 'neu')) assert.equal(s.rezept, rezept);
	assert.equal(knotenSzene(rezept, 2)[0].rezept.rauschen, null);
	assert.deepEqual(knotenSzene(rezept, 6)[0].rezept, rezept);
	assert.match(tslQuelle(rezept)[1].code, /--cat-nature/);
});

it('keeps named opaque mineral finishes unpigmented while exposing the diagram opacity and edge choices', () => {
	let z = waehleMaterial(materialStart(), 'strom', 'water');
	z = waehleMaterial(z, 'finish', 'beton-geadert');
	z = waehleMaterial(z, 'deckkraft', 'trace');
	z = waehleMaterial(z, 'kante', 'keine');
	const w = materialWerkstatt(z);
	assert.equal(w.stromAktiv, false);
	assert.equal(w.deckkraftAktiv, false);
	assert.equal(w.rezept.farbe.token, '--paper');
	assert.equal(w.rezept.kante, null);
	assert.ok(w.rezept.haut.deckkraft < 1);
});

it('varies only the focused surface and leaves construction, supports and authored assembly choices intact', () => {
	const start = waehleMaterial(materialStart(), 'familie', 'metall');
	const neu = waehleMaterial(waehleMaterial(start, 'noise', 'strong'), 'seed', 313);
	const original = materialWerkstatt(start);
	assert.ok(original.rezept.rauschen);
	assert.equal(original.rezept.rauschen.versatzM, undefined);
	const w = materialWerkstatt(neu);
	assert.deepEqual(
		w.stuecke.map((s) => s.teil),
		original.stuecke.map((s) => s.teil)
	);
	assert.deepEqual(w.stuecke[0], original.stuecke[0]);
	const strip = leisteSzene(neu.wahl.strom, w.fokus);
	assert.equal(strip[0].rezept, w.rezept);
	assert.deepEqual(strip[0].variation, neu.variation);
	assert.deepEqual(strip.slice(1), leisteSzene(neu.wahl.strom).slice(1));
	assert.ok(w.rezept.rauschen);
	assert.deepEqual(w.rezept.rauschen.versatzM, musterVersatzM(313));
	assert.match(tslQuelle(w.rezept)[2].code, /positionWorld.add\(vec3\(/);
	assert.equal(tslQuelle(w.rezept)[3].code, tslQuelle(original.rezept)[3].code);
	assert.deepEqual(w.stuecke[1].variation, { noise: 'strong', seed: 313 });
	assert.ok(w.rezept.rauschen.staerke > original.rezept.rauschen.staerke);
	const assembly = materialWerkstatt(waehleMaterial(neu, 'form', 'montage'));
	assert.ok(assembly.fokus);
	assert.equal(assembly.fokus.id, 'wind-screen');
	assert.equal(
		materialWerkstatt(waehleMaterial(materialStart(), 'form', 'montage')).fokus,
		undefined
	);
	const courtyard = mischSzene();
	for (const [i, s] of assembly.stuecke.entries()) {
		assert.deepEqual(s.rezept, courtyard[i].rezept);
		assert.equal(s.variation, undefined);
	}
});

it('keeps added tower pieces editable and existing buildings fixed', () => {
	const z = waehleMaterial(materialStart(), 'form', 'bestand');
	const { stuecke } = materialWerkstatt(waehleMaterial(z, 'finish', 'beton-terrazzo'));
	assert.deepEqual(
		stuecke.map((s) => s.ausfuehrung),
		[undefined, 'beton-terrazzo', 'beton-terrazzo']
	);
	assert.equal(stuecke[0].rezept.familie, 'bestand');
});

it('selects authored diagram examples and resets incompatible finishes and axes atomically', () => {
	const start = waehleMaterial(materialStart(), 'finish', 'beton-geadert');
	const sample = waehleMaterial(start, 'beispiel', 'metall');
	assert.equal(sample.finish.id, 'metall-lackiert');
	assert.equal(sample.wahl.strom, 'people');
	assert.deepEqual(
		knotenSzene(materialWerkstatt(sample).rezept, 6),
		rezeptSzene('metall', 'people', 6)
	);
	assert.deepEqual(waehleMaterial(sample, 'finish', 'beton-terrazzo'), sample);
	assert.equal(waehleMaterial(sample, 'familie', 'glas').wahl.strom, 'people');
	assert.equal(materialStart().wahl.strom, 'neutral');
});
