import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { lackfilmGeometrie } from './materialLackfilmGeometrie';

test('the run-off has real thickness, an open lower contour and bounded vertices', () => {
	const g = lackfilmGeometrie(4.4, 3.8, 5, 57);
	g.computeBoundingBox();
	const bounds = g.boundingBox;
	assert.ok(bounds);
	assert.ok(bounds.min.y > 0.1 && bounds.min.y < 3.5);
	assert.equal(bounds.max.y, 5);
	assert.ok(bounds.max.x > 2.13 && bounds.max.x <= 2.2);
	assert.ok(bounds.max.z > 1.83 && bounds.max.z <= 1.9);
	assert.ok(g.getAttribute('normal').array.every(Number.isFinite));
	g.dispose();
});

test('the roof and outward-facing wet wall render from above and outside', () => {
	const material = new MeshBasicMaterial();
	const g = lackfilmGeometrie(4.4, 3.8, 5, 57);
	const mesh = new Mesh(g, material);
	const roof = new Raycaster(new Vector3(0.1, 6, 0.2), new Vector3(0, -1, 0));
	const wall = new Raycaster(new Vector3(0.1, 4.7, -4), new Vector3(0, 0, 1));
	assert.equal(roof.intersectObject(mesh)[0]?.point.y, 5);
	assert.ok((wall.intersectObject(mesh)[0]?.point.z ?? 0) < -1.8);
	g.dispose();
	material.dispose();
});
