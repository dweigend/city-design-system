import * as THREE from 'three/webgpu';
import { cellAtPoint, type TerrainGrid } from '../../logic/terrain-grid';
import { createTerrainPicker } from './terrain-pick';
import type { View } from './view';

/** The nearest seated solid or terrain cell, with explicitly owned roof facets and strokes. */
export function createCellPicker(view: View) {
	const ray = new THREE.Raycaster();
	const terrain = createTerrainPicker();
	let shownGrid: TerrainGrid | undefined;

	return (x: number, y: number, grid: TerrainGrid, targets: THREE.Object3D[]) => {
		if (shownGrid !== grid) {
			terrain.setGrid(grid);
			shownGrid = grid;
		}
		ray.params.Line.threshold = view.metersPerPixel() / 2;
		ray.setFromCamera(view.ndc(x, y), view.camera);
		const solid = ray.intersectObjects(targets, false)[0];
		const ground = terrain.pick(ray.ray, solid?.distance);
		return ground?.index ?? solidOwner(grid, solid);
	};
}

function solidOwner(grid: TerrainGrid, hit?: THREE.Intersection) {
	if (!hit) return;
	const cellId = hit.object.userData.cellId;
	if (cellId) return grid.cellsById.get(cellId)?.index;
	return cellAtPoint(grid, hit.point.x, -hit.point.z)?.index;
}
