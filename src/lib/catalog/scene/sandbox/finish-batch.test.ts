import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SphereGeometry, type Mesh } from 'three/webgpu';
import { materials } from '../../data/material';
import { materialAusfuehrungen } from '../../data/materialAusfuehrung';
import { forms } from './fixtures/primitive-forms';
import { focuses } from '../../logic/presentation';
import {
	beginStroke,
	createWorld,
	currentStacks,
	extendStroke,
	houseView,
	installationPartView
} from '../../logic/sandbox';
import { loadStructureModules } from './fixtures/structure-modules';

test('every catalog surface reaches the sandbox mesh for every surface-bearing form', async () => {
	const [{ structureMaterials }, { populateStructures }] = await loadStructureModules();
	const pool = structureMaterials();
	const bearing = new SphereGeometry();
	try {
		for (const form of Object.values(forms)) {
			if (form.kind === 'polyline') continue;
			let positions: ArrayLike<number> | undefined;
			for (const { id: finish } of [...materials, ...materialAusfuehrungen]) {
				const group = populateStructures([{ ...form, role: 'bestand', finish }], pool, bearing);
				const hits: Mesh[] = group.userData.hits;
				assert.equal(hits.length, 1);
				const [mesh] = hits;
				assert.equal(mesh.material, pool.explicit.material(finish, form.token));
				assert.equal(Array.isArray(mesh.material) ? '' : mesh.material.name, finish);
				const coords = mesh.geometry.getAttribute('position').array;
				assert.ok(
					coords.length > 0 && coords.length % 9 === 0 && coords.every(Number.isFinite),
					form.kind
				);
				assert.deepEqual(coords, positions ?? coords);
				positions = coords;
				mesh.geometry.dispose();
			}
		}
	} finally {
		pool.dispose();
		bearing.dispose();
	}
});

test('painting a water collage builds a closed draped roof with an independent glaze', () => {
	const world = createWorld(7);
	const cell = world.grid.cellsById.get('79/44');
	assert.ok(cell);
	const { draft } = extendStroke(
		beginStroke({ kind: 'house', style: 'collage', use: 'water' }, world),
		cell.id
	);
	const roof = houseView(draft, currentStacks(draft.state), cell.chunk, focuses.all).find((p) =>
		p.id.endsWith(':canopy')
	);
	assert.ok(roof?.kind === 'mesh');
	assert.equal(roof.finish, 'glaze');
	const edges = new Map<string, number>();
	for (let i = 0; i < roof.triangles.length; i += 3) {
		const tri = roof.triangles.slice(i, i + 3);
		for (const [j, a] of tri.entries()) {
			const b = tri[(j + 1) % 3],
				key = [Math.min(a, b), Math.max(a, b)].join('/');
			edges.set(key, (edges.get(key) ?? 0) + (a < b ? 1 : -1));
		}
	}
	assert.ok(edges.size > 0 && [...edges.values()].every((n) => n === 0));
});

test('different forms share one draw mesh per selected finish', async () => {
	const [{ structureMaterials }, { populateStructures }] = await loadStructureModules();
	const pool = structureMaterials();
	const bearing = new SphereGeometry();
	try {
		const parts = Object.values(forms).filter((p) => p.kind !== 'polyline');
		const group = populateStructures(
			parts.flatMap((p) => [
				{ ...p, finish: 'glaze' as const },
				{ ...p, finish: 'beton-terrazzo' as const }
			]),
			pool,
			bearing
		);
		const hits: Mesh[] = group.userData.hits;
		assert.equal(hits.length, 2);
		const [glaze, terrazzo] = hits;
		assert.equal(glaze.material, pool.explicit.material('glaze', forms.mesh.token));
		assert.equal(terrazzo.material, pool.explicit.material('beton-terrazzo', forms.mesh.token));
		for (const attribute of ['position', 'normal', 'uv', 'finishChart']) {
			const values = glaze.geometry.getAttribute(attribute).array;
			assert.ok(values.length && values.every(Number.isFinite));
			assert.deepEqual(values, terrazzo.geometry.getAttribute(attribute).array);
		}
		for (const hit of hits) hit.geometry.dispose();
	} finally {
		pool.dispose();
		bearing.dispose();
	}
});

test('a finish on a saved installation slot applies after its socket geometry is restored', () => {
	const world = createWorld(7);
	const installed = extendStroke(
		beginStroke({ kind: 'house', style: 'megastructure', use: 'water' }, world),
		'89/41'
	).draft;
	const slot = [...installed.state.parts.values()].find((p) => p.recipe === 'bearing');
	assert.ok(slot);
	const original = installationPartView(installed, slot, 'all');
	const finished = installationPartView(installed, { ...slot, finish: 'beton-terrazzo' }, 'all');
	assert.ok(finished.length);
	assert.deepEqual(
		finished,
		original.map((part) => ({ ...part, finish: 'beton-terrazzo' }))
	);
});
