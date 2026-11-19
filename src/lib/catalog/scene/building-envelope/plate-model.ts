import * as THREE from 'three';
import type { EnvelopePlateMesh } from '../../logic/envelope-plate';

import { envelopeGeometry } from './geometry';
/** Projects one specimen with its assigned shared finish. The model owns only its geometry. */
export function plateModel(
	mesh: EnvelopePlateMesh,
	finishes: Record<EnvelopePlateMesh['material'], THREE.Material>,
	line: THREE.Material
) {
	const geometry = envelopeGeometry(mesh);
	geometry.center();
	const solid = new THREE.Mesh(geometry, finishes[mesh.material]);
	const edges = new THREE.EdgesGeometry(geometry, 14);
	solid.add(new THREE.LineSegments(edges, line));
	return {
		solid,
		dispose() {
			geometry.dispose();
			edges.dispose();
		}
	};
}
