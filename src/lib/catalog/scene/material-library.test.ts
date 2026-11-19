import { expect, test } from 'bun:test';
import { Color, MeshPhysicalNodeMaterial } from 'three/webgpu';
import { finishCatalogue, resolveFinish } from '../logic/material/surface';
import { tokenColor } from './material';
import { createMaterialLibrary } from './material-library';
import { forms } from '../logic/material/sample-forms';
import { finishedMeshes } from './sandbox/finish-batch';

test('flat, curved and indexed forms resolve every finish with use, ink and paper pigments', () => {
	for (const [paper, ink] of [['#faf8f4', '#20242a'], ['#20242a', '#faf8f4']]) {
		const palette = { paper, ink, blueprint: ink, blueprintSoft: paper,
			categories: { '--body-living': '#9566bb', 'health-3': '#80b2e0', nature: '#639d72' } };
		const library = createMaterialLibrary(palette);
		for (const token of ['--paper', '--ink', '--body-living', '--cat-health-3', '--cat-nature'] as const) {
			const pigment = tokenColor(palette, token);
			expect(pigment).toEqual(new Color(token === '--ink' ? ink : token === '--paper' ? paper :
				palette.categories[token.replace('--cat-', '') as keyof typeof palette.categories]));
			for (const { id } of finishCatalogue) {
				const spec = resolveFinish(id, token);
				expect(resolveFinish(id, token)).toEqual(spec);
				const face = library.material(spec);
				expect(library.material(resolveFinish(id, token))).toBe(face);
				expect(face.name).toBe(id);
				if (face instanceof MeshPhysicalNodeMaterial) expect(face.color.toArray()).toEqual(pigment.toArray());
				const parts = [forms.box, forms.torus, forms.mesh].map(p => ({ ...p, token, finish: id }));
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
