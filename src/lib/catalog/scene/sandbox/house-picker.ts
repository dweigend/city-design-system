import * as THREE from 'three/webgpu';
import { stackTop } from '../../logic/house-brush';
import type { World } from '../../logic/sandbox';
import { inradius } from '../../logic/quad-grid';
import { pushThree } from '../world-space';
import type { View } from './view';

// Two side triangles per quad between successive rings, then the two cap triangles.
const sides = [0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
const triangles = [...sides, ...sides.map((i) => i + 4), 8, 9, 10, 8, 10, 11];
function housePrisms(world: World) {
	const positions: number[] = [],
		indices: number[] = [],
		owners: number[] = [];
	for (const id of world.state.stacks.keys()) {
		const cell = world.grid.cellsById.get(id);
		if (!cell) continue;
		const offset = positions.length / 3;
		// The upper ring approximates the terrace setback and roof without evaluating the grammar.
		const eaves = stackTop(world.state.stacks, cell);
		const cap = eaves + inradius(cell) * 0.5 + 0.5;
		for (const corner of cell.corners) pushThree(positions, corner);
		for (const [x, y] of cell.corners) pushThree(positions, [x, y, eaves]);
		for (const [x, y] of cell.corners)
			pushThree(positions, [x + (cell.center[0] - x) * 0.3, y + (cell.center[1] - y) * 0.3, cap]);
		for (const i of triangles) indices.push(offset + i);
		owners.push(cell.index);
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setIndex(indices);
	return { geometry, owners };
}

/** CPU picking: nearest occupied cell prism, then the terrain triangle under the pointer. */
export function createCellPicker(view: View, currentSurface: () => THREE.Mesh | undefined) {
	const ray = new THREE.Raycaster();
	const houses = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
	let owners: number[] = [];
	let grid: World['grid'] | undefined;
	let stacks: World['state']['stacks'] | undefined;
	return {
		update(world: World) {
			if (grid === world.grid && stacks === world.state.stacks) return;
			const next = housePrisms(world);
			houses.geometry.dispose();
			houses.geometry = next.geometry;
			owners = next.owners;
			grid = world.grid;
			stacks = world.state.stacks;
		},
		pick(x: number, y: number) {
			ray.setFromCamera(view.ndc(x, y), view.camera);
			const face = owners.length ? ray.intersectObject(houses, false)[0]?.faceIndex : undefined;
			if (face != null) return owners[Math.floor(face / (triangles.length / 3))];
			const surface = currentSurface();
			const ground = surface && ray.intersectObject(surface, false)[0]?.faceIndex;
			return ground == null ? undefined : ground >> 1;
		},
		dispose() {
			houses.geometry.dispose();
			houses.material.dispose();
		}
	};
}
