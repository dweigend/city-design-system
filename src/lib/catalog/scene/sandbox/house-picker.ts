import * as THREE from 'three/webgpu';
import { cellAtPoint, type TerrainGrid } from '../../logic/terrain-grid';
import type { View } from './view';

/** Returns the cell of the nearest visible solid or terrain face. Roof proxies resolve to their owning house. */
export function createCellPicker(view: View) {
	const ray = new THREE.Raycaster();
	return (
		x: number,
		y: number,
		grid: TerrainGrid,
		surface: THREE.Mesh,
		solids: THREE.Object3D[]
	) => {
		ray.params.Line.threshold = view.metersPerPixel() / 2;
		ray.setFromCamera(view.ndc(x, y), view.camera);
		const hit = ray.intersectObjects([surface, ...solids], false)[0];
		if (!hit) return undefined;
		if (hit.object === surface) return hit.faceIndex == null ? undefined : hit.faceIndex >> 1;
		if (hit.object.userData.cellId) return grid.cellsById.get(hit.object.userData.cellId)?.index;
		return cellAtPoint(grid, hit.point.x, -hit.point.z)?.index;
	};
}
