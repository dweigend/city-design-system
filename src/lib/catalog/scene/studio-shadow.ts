import { MeshPhysicalNodeMaterial, type Material, type Mesh } from 'three/webgpu';

/** Opaque surfaces cast and receive the key. Transmissive glazing admits light to the interior. */
export function studioShadow(mesh: Mesh, material: Material, family?: string) {
	const transmission = material instanceof MeshPhysicalNodeMaterial && material.transmission > 0;
	mesh.castShadow = !material.transparent && (!transmission || family === 'membran');
	mesh.receiveShadow = !transmission;
}
