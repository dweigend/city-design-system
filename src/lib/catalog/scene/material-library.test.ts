import { scenePalette } from './scene-palette';
import { readFileSync } from 'node:fs';
import { surfaceTokens } from '../logic/parametrik/types';
import { colorOf, parsePalette } from '../logic/farbe/palette';
import { linearToHex, oklchToLinear } from '../logic/farbe/oklch';
import { expect, test } from 'bun:test';
import { Color, MeshPhysicalNodeMaterial } from 'three/webgpu';
import { finishCatalogue, resolveFinish } from '../logic/material/surface';
import { oberflaechenWerte } from '../logic/material/ausfuehrung';
import { tokenColor } from './material';
import { createMaterialLibrary } from './material-library';
import { forms } from '../logic/material/sample-forms';
import { finishedMeshes } from './sandbox/finish-batch';

test('flat, curved and indexed forms resolve every finish with use, ink and paper pigments', () => {
	const css = parsePalette(readFileSync(new URL('../../../app.css', import.meta.url), 'utf8'));
	for (const mode of ['light', 'dark'] as const) {
		const hex = (token: string) => linearToHex(oklchToLinear(colorOf(css, mode, token)));
		const palette = scenePalette((names) =>
			Object.fromEntries(
				names.map((token) => [token, hex(token === '--blueprint-soft' ? '--paper' : token)])
			)
		);
		const library = createMaterialLibrary(palette);
		for (const token of surfaceTokens) {
			const pigment = tokenColor(palette, token);
			expect(pigment).toEqual(new Color(hex(token)));
			for (const { id } of finishCatalogue) {
				checkFinish(library, token, id, pigment);
			}
		}
		library.dispose();
	}
});

function checkFinish(
	library: ReturnType<typeof createMaterialLibrary>,
	token: (typeof surfaceTokens)[number],
	id: (typeof finishCatalogue)[number]['id'],
	pigment: Color
) {
	const spec = resolveFinish(id, token);
	expect(resolveFinish(id, token)).toEqual(spec);
	const face = library.material(spec);
	expect(library.material(resolveFinish(id, token))).toBe(face);
	expect(face.name).toBe(id);
	expect(
		JSON.stringify(spec, (_key, value: unknown) => {
			if (typeof value === 'number' && !Number.isFinite(value))
				throw Error('Non-finite material parameter');
			return value;
		})
	).toBeDefined();
	if (spec.kind === 'physical') {
		const finish = oberflaechenWerte(spec.recipe, spec.id);
		expect(face).toBeInstanceOf(MeshPhysicalNodeMaterial);
		if (face instanceof MeshPhysicalNodeMaterial)
			expect(face.color.toArray()).toEqual(
				new Color(finish.grundton).lerp(pigment, finish.pigment).toArray()
			);
	}
	const parts = [forms.box, forms.torus, forms.mesh].map((p) => ({
		...p,
		token,
		finish: id
	}));
	const [mesh] = finishedMeshes(parts, library);
	expect(mesh.material).toBe(face);
	for (const attribute of Object.values(mesh.geometry.attributes))
		expect(attribute.array.every(Number.isFinite)).toBe(true);
	mesh.geometry.dispose();
}

test('painted steel shares an age-specific material across geometries', () => {
	const library = createMaterialLibrary();
	const fresh = { ...forms.box, token: '--cat-health', finish: 'metal' } as const;
	const aged = { ...fresh, ageTint: 0.06 };
	const meshes = finishedMeshes([fresh, aged, { ...aged, id: 'second' }], library);
	try {
		expect(meshes).toHaveLength(2);
		const recipe = resolveFinish('metal', fresh.token, 0.06);
		if (recipe.kind !== 'diagram') throw Error('Expected painted steel');
		expect(recipe.recipe.farbe.papier).toBeGreaterThan(0);
		expect(meshes[1].material).toBe(library.material(recipe));
	} finally {
		for (const mesh of meshes) mesh.geometry.dispose();
		library.dispose();
	}
});

test('frosted acrylic transmits through a tinted volume and metal punches cast holes', () => {
	const library = createMaterialLibrary();
	try {
		const acrylic = library.material(resolveFinish('acryl-matt', '--paper'));
		const sheet = library.material(resolveFinish('perforated-metal', '--paper'));
		if (!(acrylic instanceof MeshPhysicalNodeMaterial && sheet instanceof MeshPhysicalNodeMaterial))
			throw Error('Expected physical finishes');
		expect(acrylic.transmission).toBeGreaterThan(0.5);
		expect(acrylic.thickness).toBeGreaterThan(0);
		expect(acrylic.attenuationColor).toEqual(acrylic.color);
		expect(sheet.maskNode).toBeTruthy();
		expect(sheet.maskShadowNode).toBe(sheet.maskNode);
	} finally {
		library.dispose();
	}
});
