/** Physical specimen projection. Local x right, y up, z = negative logical depth. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Teil } from '../logic/material/formen';
import { brockenGeometrie, facettenGeometrie } from './materialBrockenGeometrie';
import { florGeometrie } from './materialFlorGeometrie';
import { folienGeometrie } from './materialFolienGeometrie';
import { lackfilmGeometrie } from './materialLackfilmGeometrie';
import { membranGeometrie } from './materialKissenGeometrie';
import { wellenplatte } from './materialWellenplatte';

function rechteck(w: number, h: number): THREE.Shape {
	const s = new THREE.Shape();
	s.moveTo(-w / 2, 0);
	s.lineTo(w / 2, 0);
	s.lineTo(w / 2, h);
	s.lineTo(-w / 2, h);
	s.closePath();
	return s;
}

function lochplatte(w: number, d: number, h: number): THREE.BufferGeometry {
	const shape = rechteck(w, h);
	const columns = 7,
		rows = 6;
	const radius = Math.min(w / (columns + 1), h / (rows + 1)) * 0.29;
	for (let row = 1; row <= rows; row++) {
		for (let col = 1; col <= columns; col++) {
			const hole = new THREE.Path();
			hole.absarc(
				-w / 2 + (w * col) / (columns + 1),
				(h * row) / (rows + 1),
				radius,
				0,
				Math.PI * 2,
				true
			);
			shape.holes.push(hole);
		}
	}
	return new THREE.ExtrudeGeometry(shape, {
		depth: d,
		bevelEnabled: false,
		curveSegments: 16
	}).translate(0, 0, -d / 2);
}

const regelFenster = [0, 1, 2, 3].map(
	(col) => [(col + 0.5) / 4 - 0.075, 0.22, 0.15, 0.58] as const
);

function fensterLoch(x: number, y: number, w: number, h: number): THREE.Path {
	const hole = new THREE.Path();
	hole.moveTo(x, y);
	hole.lineTo(x, y + h);
	hole.lineTo(x + w, y + h);
	hole.lineTo(x + w, y);
	hole.closePath();
	return hole;
}

function fassade(
	w: number,
	d: number,
	h: number,
	fenster: readonly (readonly [number, number, number, number])[]
): THREE.BufferGeometry {
	const shape = rechteck(w, h);
	for (const [x, y, breit, hoch] of fenster)
		shape.holes.push(fensterLoch(w * (x - 0.5), h * y, w * breit, h * hoch));
	return new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }).translate(
		0,
		0,
		-d / 2
	);
}

function wandGeometrie(
	w: number,
	d: number,
	h: number,
	profil: Extract<NonNullable<Teil['profil']>, { art: 'fassade' }>
) {
	const fenster = profil.fenster ?? regelFenster;
	return profil.quer ? fassade(d, w, h, fenster).rotateY(Math.PI / 2) : fassade(w, d, h, fenster);
}

function rohr(w: number, d: number, h: number, wand: number): THREE.BufferGeometry {
	const shape = new THREE.Shape();
	// Elliptical walls retain the quader footprint, including for non-square sections.
	shape.absellipse(0, 0, w / 2, d / 2, 0, Math.PI * 2, false, 0);
	const hole = new THREE.Path();
	hole.absellipse(0, 0, w / 2 - wand, d / 2 - wand, 0, Math.PI * 2, true, 0);
	shape.holes.push(hole);
	return new THREE.ExtrudeGeometry(shape, {
		depth: h,
		bevelEnabled: false,
		curveSegments: 48
	}).rotateX(-Math.PI / 2);
}

function faltblech(w: number, d: number, h: number): THREE.BufferGeometry {
	const folds = 6,
		thickness = Math.min(0.045, d / 5);
	const points: THREE.Vector2[] = [];
	for (let i = 0; i <= folds * 2; i++)
		points.push(
			new THREE.Vector2(-w / 2 + (w * i) / (folds * 2), ((i % 2 ? 1 : -1) * (d - thickness)) / 2)
		);
	const shape = new THREE.Shape(points);
	for (let i = points.length - 1; i >= 0; i--) shape.lineTo(points[i].x, points[i].y + thickness);
	shape.closePath();
	return new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
		.rotateX(-Math.PI / 2)
		.translate(0, 0, thickness / 2);
}

/**
 * Projects optional physical profiles into a newly owned geometry, or undefined for legacy parts.
 * Valid study dimensions are positive meters; tube walls must be below half the smaller width.
 * Hull stays centered in x/z, height starts at zero, with no position transform or input mutation.
 * Stable vertex order, no RNG/cache/I/O. Caller disposes the returned geometry. No legacy changes.
 */
export function studienGeometrie(t: Teil): THREE.BufferGeometry | undefined {
	if (!t.profil) return undefined;
	const [w, d, h] = t.mass;
	switch (t.profil.art) {
		case 'fase':
			return new RoundedBoxGeometry(
				w,
				h,
				d,
				3,
				Math.min(t.profil.radius, w / 2, d / 2, h / 2)
			).translate(0, h / 2, 0);
		case 'lochplatte':
			return lochplatte(w, d, h);
		case 'fassade':
			return wandGeometrie(w, d, h, t.profil);
		case 'flor':
			return florGeometrie(w, d, h, t.profil.wand);
		case 'rohr':
			return rohr(w, d, h, t.profil.wand);
		case 'faltblech':
			return faltblech(w, d, h);

		case 'facetten':
			return facettenGeometrie(w, d, h);
		case 'folie':
			return folienGeometrie(w, d, h);
		case 'wellenplatte':
			return wellenplatte(w, d, h);
		case 'brocken':
			return brockenGeometrie(w, d, h, t.profil.saat);
		default:
			return membranGeometrie(t.profil, w, d, h);
		case 'lackfilm':
			return lackfilmGeometrie(w, d, h, t.profil.saat);
	}
}
