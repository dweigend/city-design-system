import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Mesh } from 'three';
import { plateModel } from './models';
import { createPlateMaterials, recolorPlate } from './materials';

test('seed 17 assigns water only to the upper annulus of one closed indexed mesh', () => {
	const materials = createPlateMaterials();
	const plate = plateModel('vessel', 17, materials);
	const meshes: Mesh[] = [];
	plate.traverse((node) => {
		if (node instanceof Mesh) meshes.push(node);
	});
	assert.equal(meshes.length, 1);
	const [{ geometry, material }] = meshes;
	assert.deepEqual(material, [materials.glaze, materials.water]);
	const index = geometry.getIndex();
	assert.ok(index);
	const position = geometry.getAttribute('position');
	geometry.computeBoundingBox();
	const top = geometry.boundingBox?.max.y;
	const edges = new Map<string, number[]>();
	for (const group of geometry.groups) {
		for (let i = group.start; i < group.start + group.count; i += 3) {
			const triangle: number[] = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
			assert.equal(
				triangle.every((v) => position.getY(v) === top),
				group.materialIndex === 1
			);
			for (const [j, a] of triangle.entries()) {
				const b = triangle[(j + 1) % 3],
					key = [Math.min(a, b), Math.max(a, b)].join('/');
				const uses = edges.get(key) ?? [];
				uses.push(Math.sign(b - a));
				edges.set(key, uses);
			}
		}
	}
	assert.equal(
		geometry.groups.reduce((sum, g) => sum + g.count, 0),
		index.count
	);
	for (const uses of edges.values()) assert.deepEqual(uses.sort(), [-1, 1]);
});
test('a palette change recolors the material already assigned to the ceramic lip', () => {
	const materials = createPlateMaterials(),
		plate = plateModel('vessel', 17, materials);
	const mesh = plate.children.find((node) => node instanceof Mesh);
	assert.ok(mesh instanceof Mesh);
	const before = mesh.geometry;
	recolorPlate(materials, '#eeeeee', '#222222', '#888888', '#1188cc');
	assert.equal(mesh.geometry, before);
	assert.equal(mesh.material[1].color.getHexString(), '1188cc');
});
