import { readFileSync } from 'node:fs';
import { surfaceTokens } from '../logic/parametrik/types';
import { colorOf, parsePalette } from '../logic/farbe/palette';
import { linearToHex, oklchToLinear } from '../logic/farbe/oklch';
import { expect, test } from 'bun:test';
import { Color, MeshPhysicalNodeMaterial } from 'three/webgpu';
import { finishCatalogue, resolveFinish } from '../logic/material/surface';
import { tokenColor } from './material';
import { createMaterialLibrary } from './material-library';
import { forms } from '../logic/material/sample-forms';
import { finishedMeshes } from './sandbox/finish-batch';

test('flat, curved and indexed forms resolve every finish with use, ink and paper pigments', () => {
	const css = parsePalette(readFileSync(new URL('../../../app.css', import.meta.url), 'utf8'));
	for (const mode of ['light', 'dark'] as const) {
		const hex = (token: string) => linearToHex(oklchToLinear(colorOf(css, mode, token)));
		const palette = {
			paper: hex('--paper'),
			ink: hex('--ink'),
			blueprint: hex('--blueprint'),
			blueprintSoft: hex('--paper'),
			categories: Object.fromEntries(
				surfaceTokens.map((token) => [token.replace('--cat-', ''), hex(token)])
			)
		};
		const library = createMaterialLibrary(palette);
		for (const token of surfaceTokens) {
			const pigment = tokenColor(palette, token);
			expect(pigment).toEqual(new Color(hex(token)));
			for (const { id } of finishCatalogue) {
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
				if (face instanceof MeshPhysicalNodeMaterial)
					expect(face.color.toArray()).toEqual(pigment.toArray());
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
		}
		library.dispose();
	}
});
