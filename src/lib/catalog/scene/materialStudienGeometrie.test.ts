// @ts-expect-error Bun provides this test API at runtime.
import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { familien } from '../data/materialSeite';
import { probeSzene, mischSzene } from '../logic/material/studien';
import { form } from '../logic/material/formen';
import { siedlungEntwurf } from '../logic/material/siedlung';
import { voreinstellung } from '../logic/material/rezept';
import { studienGeometrie } from './materialStudienGeometrie';

describe('Physical specimen geometry', () => {
	test('legacy pieces opt out; projected vertices are deterministic and within advertised hulls', () => {
		expect(studienGeometrie(form('box')[0])).toBeUndefined();
		const parts = [
			...familien.flatMap((f) => probeSzene(f.id, voreinstellung(f.id))),
			...mischSzene(),
			...siedlungEntwurf(1).filter((p) => p.teil.profil)
		];
		for (const { teil } of parts) {
			const geo = studienGeometrie(teil);
			expect(geo).toBeDefined();
			const other = studienGeometrie(teil);
			assert(geo && other);
			expect(Array.from(geo.getAttribute('position').array)).toEqual(
				Array.from(other.getAttribute('position').array)
			);
			geo.computeBoundingBox();
			const b = geo.boundingBox;
			assert(b);
			const [w, d, h] = teil.mass,
				tolerance = 0.00001;
			expect(b.min.x).toBeGreaterThanOrEqual(-w / 2 - tolerance);
			expect(b.max.x).toBeLessThanOrEqual(w / 2 + tolerance);
			expect(b.min.z).toBeGreaterThanOrEqual(-d / 2 - tolerance);
			expect(b.max.z).toBeLessThanOrEqual(d / 2 + tolerance);
			expect(b.min.y).toBeGreaterThanOrEqual(-tolerance);
			expect(b.max.y).toBeLessThanOrEqual(h + tolerance);
			expect(Array.from(geo.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
			geo.dispose();
			other.dispose();
		}
	});
	test('featured perforation has an open center, solid ligaments and cylindrical depth walls', () => {
		const piece = probeSzene('metall', voreinstellung('metall')).find(
			(s) => s.teil.profil?.art === 'lochplatte'
		);
		assert(piece);
		const geo = studienGeometrie(piece.teil);
		assert(geo);
		const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
		const [w, d, h] = piece.teil.mass;
		const ray = new THREE.Raycaster();
		ray.set(new THREE.Vector3(0, (h * 3) / 7, 1), new THREE.Vector3(0, 0, -1));
		expect(ray.intersectObject(mesh).length).toBe(0);
		ray.set(new THREE.Vector3(-w / 2 + 0.025, h / 2, 1), new THREE.Vector3(0, 0, -1));
		expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
		// From inside the aperture, a horizontal ray hits the hole wall within plate thickness.
		ray.set(new THREE.Vector3(0, (h * 3) / 7, 0), new THREE.Vector3(1, 0, 0));
		expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
		expect(d).toBeGreaterThan(0.05);
		geo.dispose();
		mesh.material.dispose();
	});
	test('stock window apertures expose reveals and the timber beams run along X', () => {
		const stock = probeSzene('bestand', voreinstellung('bestand'));
		const facade = stock.find((s) => s.teil.profil?.art === 'fassade');
		assert(facade);
		const geo = studienGeometrie(facade.teil);
		assert(geo);
		const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
		const [w, , h] = facade.teil.mass;
		const x = -w / 2 + (w * 0.5) / 4;
		const ray = new THREE.Raycaster(new THREE.Vector3(x, h / 2, 1), new THREE.Vector3(0, 0, -1));
		expect(ray.intersectObject(mesh).length).toBe(0);
		ray.set(new THREE.Vector3(x, h / 2, 0), new THREE.Vector3(1, 0, 0));
		expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
		expect(stock.some((s) => s.id === 'stock-facade-1' && s.teil.mass[0] < w)).toBe(true);
		for (const { teil } of probeSzene('holz', voreinstellung('holz')).filter(
			(s) => s.id.includes('board') || s.id.includes('grain-beam')
		)) {
			expect(teil.mass[0]).toBeGreaterThan(teil.mass[1] * 4);
		}
		geo.dispose();
		mesh.material.dispose();
	});
	test('tube has an open bore and an annular top surface', () => {
		const piece = probeSzene('metall', voreinstellung('metall')).find(
			(s) => s.teil.profil?.art === 'rohr'
		);
		assert(piece);
		const geo = studienGeometrie(piece.teil);
		assert(geo);
		const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
		const ray = new THREE.Raycaster(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, -1, 0));
		expect(ray.intersectObject(mesh).length).toBe(0);
		ray.set(new THREE.Vector3(0.38, 3, 0), new THREE.Vector3(0, -1, 0));
		expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
		geo.dispose();
		mesh.material.dispose();
	});
});
