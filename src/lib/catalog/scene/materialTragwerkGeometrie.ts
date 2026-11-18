import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StudienProfil, Vec3 } from '../logic/material/formen';

type Tragwerk = Extract<StudienProfil, { art: 'paneele' | 'streben' }>;
const oben = new THREE.Vector3(0, 1, 0);
const ort = ([x, y, z]: Vec3) => new THREE.Vector3(x, z, -y);

function paneele(felder: readonly (readonly Vec3[])[]): THREE.BufferGeometry {
	const position: number[] = [];
	const uv: number[] = [];
	for (const f of felder) {
		for (let i = 1; i < f.length - 1; i++) {
			for (const p of [f[0], f[i], f[i + 1]]) {
				position.push(...ort(p));
				uv.push(p[0], p[1]);
			}
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	geometry.computeVertexNormals();
	return geometry;
}

function stab(a: Vec3, b: Vec3, radius: number): THREE.BufferGeometry {
	const from = ort(a);
	const to = ort(b);
	const richtung = to.clone().sub(from);
	const q = new THREE.Quaternion().setFromUnitVectors(oben, richtung.clone().normalize());
	const mitte = from.add(to).multiplyScalar(0.5);
	const matrix = new THREE.Matrix4().compose(mitte, q, new THREE.Vector3(1, 1, 1));
	return new THREE.CylinderGeometry(radius, radius, richtung.length() + radius, 6).applyMatrix4(
		matrix
	);
}

/** Projects the generated polygon faces or physical frame in local meters, without separate
 * draw calls for each element. The caller owns and disposes the returned geometry. */
export function tragwerkGeometrie(profil: Tragwerk): THREE.BufferGeometry {
	if (profil.art === 'paneele') return paneele(profil.felder);
	const streben = profil.kanten.map(([a, b]) => stab(a, b, profil.radius));
	const geometry = mergeGeometries(streben);
	streben.forEach((g) => g.dispose());
	return geometry;
}
