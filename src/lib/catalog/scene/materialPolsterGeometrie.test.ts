import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { brockenGeometrie } from './materialBrockenGeometrie';
import { polsterGeometrie, polsterNahtGeometrie } from './materialPolsterGeometrie';

const [w, d, h] = [6, 4.6, 2.8];

function treffer(g: THREE.BufferGeometry, x: number, z: number) {
	const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
	const ray = new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
	return ray.intersectObject(mesh);
}

describe('Lobed membrane enclosure', () => {
	test('skin is deep, closed to the ground, outward facing and lowest between the lobes', () => {
		const g = polsterGeometrie(w, d, h);
		g.computeBoundingBox();
		const b = g.boundingBox;
		assert(b);
		expect(b.max.y).toBeGreaterThan(h * 0.85);
		expect(b.max.y).toBeLessThanOrEqual(h);
		expect(b.min.y).toBeGreaterThanOrEqual(0);
		expect(b.max.x).toBeLessThanOrEqual(w / 2);
		expect(b.max.z).toBeLessThanOrEqual(d / 2);
		const [oben] = treffer(g, 0.3, 0.2);
		expect(oben.face?.normal.y).toBeGreaterThan(0.5);
		// The plan is a cross: arm tips are inside, the diagonal corner of the hull is empty.
		expect(treffer(g, w / 2 - 0.3, 0).length).toBeGreaterThan(0);
		expect(treffer(g, w / 2 - 0.3, d / 2 - 0.3).length).toBe(0);
		expect(Array.from(g.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
		g.dispose();
	});
	test('seams stay inside the hull and sit on the skin', () => {
		const skin = polsterGeometrie(w, d, h);
		const seams = polsterNahtGeometrie(w, d, h);
		seams.computeBoundingBox();
		const b = seams.boundingBox;
		assert(b);
		expect(b.min.y).toBeGreaterThanOrEqual(-0.00001);
		expect(b.max.y).toBeLessThanOrEqual(h);
		expect(Math.max(-b.min.x, b.max.x)).toBeLessThanOrEqual(w / 2);
		expect(Math.max(-b.min.z, b.max.z)).toBeLessThanOrEqual(d / 2);
		const [haut] = treffer(skin, 0.6, 0.6 * 0);
		const [naht] = treffer(seams, w * 0.2, 0.42 * Math.min(w, d) * 0.21);
		const [hautNaht] = treffer(skin, w * 0.2, 0.42 * Math.min(w, d) * 0.21);
		expect(haut).toBeDefined();
		expect(Math.abs(naht.point.y - hautNaht.point.y)).toBeLessThan(0.06);
		skin.dispose();
		seams.dispose();
	});
});

describe('Angular block', () => {
	test('is deterministic, stands flat inside its hull and breaks its top corners', () => {
		const a = brockenGeometrie(4.5, 4.5, 4.9, 23);
		const b = brockenGeometrie(4.5, 4.5, 4.9, 23);
		expect(Array.from(a.getAttribute('position').array)).toEqual(
			Array.from(b.getAttribute('position').array)
		);
		a.computeBoundingBox();
		const box = a.boundingBox;
		assert(box);
		expect(box.min.y).toBe(0);
		expect(box.max.y).toBeCloseTo(4.9, 5);
		expect(box.max.x).toBeLessThanOrEqual(2.25);
		const ecken = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => treffer(a, sx * 2.22, sz * 2.22)));
		expect(ecken.filter((t) => t[0].point.y < 4.8).length).toBeGreaterThan(1);
		expect(treffer(a, 0, 0).length).toBeGreaterThan(0);
		a.dispose();
		b.dispose();
	});
});
