import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LineBasicMaterial, MeshStandardMaterial } from 'three';
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
