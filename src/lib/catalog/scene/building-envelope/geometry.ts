import * as THREE from 'three';
import type { EnvelopeMesh } from '../../logic/building-envelope';
/** Projects a headless envelope into three.js (world x/y plan, z up). Caller owns geometry. */
export function envelopeGeometry(mesh: EnvelopeMesh) {
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions.slice(), 3));
	geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
	geometry.rotateX(-Math.PI / 2);
	geometry.computeVertexNormals();
	return geometry;
}
