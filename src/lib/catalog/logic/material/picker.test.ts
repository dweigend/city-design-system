import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flowToken } from '../../data/focus';
import {
	ausgeschlosseneTexturen,
	pickerFarben,
	pickerMaterialien
} from '../../data/materialPicker';
import { ausfuehrungenVon, oberflaechenWerte } from './ausfuehrung';
import { hausRezept } from './hausBausteine';
import {
	pickerHaut,
	pickerRaeder,
	pickerStart,
	pickerSzene,
	waehlePicker,
	type FarbZiel,
	type PickerZustand
} from './picker';

function* skins() {
	for (const material of pickerMaterialien) {
		for (const finish of ausfuehrungenVon(material)) {
			if (!ausgeschlosseneTexturen.has(finish.id))
				yield { ...pickerStart(), material, textur: finish.id };
		}
	}
}

const finishVon = (z: PickerZustand) => ausfuehrungenVon(z.material).find((f) => f.id === z.textur);
const texturName = (z: PickerZustand) => finishVon(z)?.name ?? '';
const texturPigment = (z: PickerZustand) => finishVon(z)?.pigment;

function geometry(z: PickerZustand) {
	return pickerSzene(z).stuecke.map(({ id, teil }) => ({ id, teil }));
}

test('every wheel combination preserves the geometry and part order', () => {
	const basis = geometry(pickerStart());
	for (const skin of skins()) {
		const material = waehlePicker(pickerStart(), 'material', skin.material);
		const textur = waehlePicker(material, 'textur', skin.textur);
		assert.equal(textur.textur, skin.textur);
		for (const farbe of pickerFarben) {
			const z = waehlePicker(textur, 'farbe', farbe);
			assert.deepEqual(z, { ...skin, farbe });
			assert.deepEqual(geometry(z), basis);
		}
	}
});

test('material switches retain color and seed, and invalid choices preserve state identity', () => {
	const z = { ...pickerStart(), farbe: 'energy', saat: 42 } as const;
	for (const material of pickerMaterialien) {
		const next = waehlePicker(z, 'material', material);
		const options = pickerRaeder(next);
		assert.equal(next.material, material);
		assert.equal(next.textur, options.textur[0].value);
		assert.deepEqual(
			[...options.textur.map((o) => o.value)].sort(),
			ausfuehrungenVon(material)
				.filter((f) => !ausgeschlosseneTexturen.has(f.id))
				.map((f) => f.id)
				.sort()
		);
		assert.equal(options.textur[0].value, ausfuehrungenVon(material)[0].id);
		assert.deepEqual(
			options.farbe.map((o) => o.value),
			pickerFarben
		);
		assert.equal(next.farbe, z.farbe);
		assert.equal(next.saat, z.saat);
	}
	const metal = waehlePicker(z, 'material', 'metall');
	for (const id of ausgeschlosseneTexturen) assert.equal(waehlePicker(metal, 'textur', id), metal);
	for (const field of ['farbe', 'textur', 'material', 'saat'] as const)
		assert.equal(waehlePicker(z, field, 'invalid'), z);
	assert.equal(waehlePicker(z, 'textur', 'holz-natur'), z);
	assert.equal(waehlePicker(z, 'saat', Infinity), z);
	assert.equal(waehlePicker(z, 'saat', -2).saat, 0);
	assert.equal(waehlePicker(z, 'saat', 65536).saat, 65535);
	assert.equal(waehlePicker(z, 'saat', 2.6).saat, 3);
});

function pruefeFarbe(z: PickerZustand, farbe: PickerZustand['farbe'], target: FarbZiel) {
	const fixed = target === 'akzent';
	const haut = pickerHaut({ ...z, farbe });
	assert.equal(haut.farbZiel, target);
	assert.ok(haut.status.startsWith(texturName(z)));
	const shell = hausRezept(haut.huelle);
	const pigment = oberflaechenWerte(shell, z.textur).pigment;
	const accent = hausRezept(haut.akzent);
	if (farbe === 'natur' || fixed) assert.equal(pigment, 0);
	else assert.ok(pigment >= 0.7);
	assert.ok(haut.status.length > 0);
	if (farbe === 'natur') assert.equal(accent.farbe.token, '--paper');
	else {
		assert.equal((fixed ? accent : shell).farbe.token, flowToken[farbe]);
		if (fixed) assert.equal(oberflaechenWerte(accent, haut.akzent.finish).pigment, 0.9);
	}
}

test('each flow reaches its intended surface and Own restores native tones', () => {
	for (const z of skins()) {
		const fixed = z.material === 'glas' || texturPigment(z) === 0;
		for (const farbe of pickerFarben) {
			pruefeFarbe(z, farbe, fixed ? 'akzent' : 'huelle');
		}
	}
});

test('pigment-free finishes route color to the accent, and the plinth joins it', () => {
	const z = { material: 'beton', textur: 'beton-schaum', farbe: 'people', saat: 1 } as const;
	const haut = pickerHaut(z);
	assert.equal(haut.farbZiel, 'akzent');
	assert.match(haut.status, /keeps its color · People on door, cornice and plinth/);
	const plinth = pickerSzene(z).stuecke.find((s) => s.id.endsWith('plinth'));
	assert.equal(plinth?.rezept.farbe.token, flowToken.people);
	const natur = pickerSzene({ ...z, farbe: 'natur' }).stuecke.find((s) => s.id.endsWith('plinth'));
	assert.equal(natur?.rezept.farbe.token, '--paper');
});

test('the default texture neighbour differs at a glance: glazed clay is followed by checkerboard', () => {
	const textur = pickerRaeder(pickerStart()).textur.map((o) => o.value);
	assert.deepEqual(textur.slice(0, 2), ['keramik-glasiert', 'keramik-schachbrett']);
});
