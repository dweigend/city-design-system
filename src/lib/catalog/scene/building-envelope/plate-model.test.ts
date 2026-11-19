import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import expected from './fixtures/default-view-hashes.json';
import { test } from 'node:test';
import { LineSegments, LineBasicMaterial, MeshStandardMaterial } from 'three';
import { loadEnvelopePlate } from '../../labor/envelope-plate.server';
import { plateModel } from './plate-model';

test('hip and gable accept either shared finish without changing their geometry', async () => {
	const { meshes } = await loadEnvelopePlate();
	const finishes = { paper: new MeshStandardMaterial(), glaze: new MeshStandardMaterial() };
	const line = new LineBasicMaterial();
	for (const mesh of [meshes[0], meshes[3]]) {
		const paper = plateModel({ ...mesh, material: 'paper' }, finishes, line);
		const glazed = plateModel({ ...mesh, material: 'glaze' }, finishes, line);
		assert.equal(paper.solid.material, finishes.paper);
		assert.equal(glazed.solid.material, finishes.glaze);
		assert.deepEqual(
			paper.solid.geometry.attributes.position.array,
			glazed.solid.geometry.attributes.position.array
		);
		assert.deepEqual(paper.solid.geometry.index?.array, glazed.solid.geometry.index?.array);
		paper.dispose();
		glazed.dispose();
	}
	finishes.glaze.dispose();
	finishes.paper.dispose();
	line.dispose();
});

// Frozen on a9e6cba in the plate's roof-row and footprint-column order.
test('each default view retains its projected triangles, normals, edges and bound finish', async () => {
	const { meshes } = await loadEnvelopePlate();
	const finishes = { paper: new MeshStandardMaterial(), glaze: new MeshStandardMaterial() };
	const line = new LineBasicMaterial();
	try {
		const hashes = meshes.map((mesh) => {
			const model = plateModel(mesh, finishes, line);
			try {
				const { solid } = model;
				const edges = solid.children[0];
				assert.ok(edges instanceof LineSegments && solid.geometry.index);
				const finish = Object.entries(finishes).find(([, m]) => solid.material === m);
				assert.ok(finish);
				const hash = createHash('sha256').update(finish[0]);
				for (const buffer of [
					solid.geometry.attributes.position.array,
					solid.geometry.attributes.normal.array,
					solid.geometry.index.array,
					edges.geometry.attributes.position.array
				]) {
					hash.update(Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength));
				}
				return hash.digest('hex');
			} finally {
				model.dispose();
			}
		});
		assert.deepEqual(hashes, expected);
	} finally {
		finishes.paper.dispose();
		finishes.glaze.dispose();
		line.dispose();
	}
});
