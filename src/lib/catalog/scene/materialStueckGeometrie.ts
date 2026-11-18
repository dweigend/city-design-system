import * as THREE from 'three/webgpu';
import type { Teil } from '../logic/material/formen';

type GeometrieFabrik = (a: number, b: number, c: number) => THREE.BufferGeometry;

const geometrien: Record<Teil['art'], GeometrieFabrik> = {
	quader: (w, d, h) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0),
	zylinder: (r, _, h) => new THREE.CylinderGeometry(r, r, h, 72).translate(0, h / 2, 0),
	kuppel: (r) => new THREE.SphereGeometry(r, 72, 36, 0, 2 * Math.PI, 0, Math.PI / 2),
	kugel: (r) => new THREE.SphereGeometry(r, 72, 48).translate(0, r, 0)
};

const hoehe: Record<Teil['art'], (mass: Teil['mass']) => number> = {
	quader: ([, , h]) => h,
	zylinder: ([, , h]) => h,
	kuppel: ([r]) => r,
	kugel: ([r]) => 2 * r
};

/** Model coordinates are x right, y depth, z up. The stage uses x right, y up, −z depth. */
export function stueckOrt(t: Teil): THREE.Vector3 {
	const [x, y, z] = t.lage;
	return new THREE.Vector3(x, z, -y);
}

/** Extends the supplied stage bounds by the full footprint and height of a part. */
export function stueckHuelle(t: Teil, box: THREE.Box3): void {
	const p = stueckOrt(t);
	const [a, b] = t.mass;
	const [w, d] = t.art === 'quader' ? [a / 2, b / 2] : [a, a];
	box.expandByPoint(new THREE.Vector3(p.x - w, p.y, p.z - d));
	box.expandByPoint(new THREE.Vector3(p.x + w, p.y + hoehe[t.art](t.mass), p.z + d));
}

/** Creates the legacy specimen geometry. The caller disposes it. */
export function stueckGeometrie(t: Teil): THREE.BufferGeometry {
	return geometrien[t.art](...t.mass);
}

/** Radius in meters of the circle enclosing the part's footprint. */
export function stueckRadius(t: Teil): number {
	return t.art === 'quader' ? Math.hypot(t.mass[0], t.mass[1]) / 2 : t.mass[0];
}
