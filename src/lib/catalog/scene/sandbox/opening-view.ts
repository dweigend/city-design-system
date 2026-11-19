import * as THREE from 'three/webgpu';
import { STORY } from '../../data/grid';
import type { World } from '../../logic/sandbox';
import type { OpeningArea, View } from './view';

function centralCell({ grid, state }: World) {
	const cells = [...state.stacks.keys()].flatMap((id) => {
		const cell = grid.cellsById.get(id);
		return cell ? [cell] : [];
	});
	if (!cells.length) return;
	const [sumX, sumY] = cells.reduce(([x, y], { center }) => [x + center[0], y + center[1]], [0, 0]);
	const distance = ({ center }: (typeof cells)[number]) =>
		Math.hypot(center[0] - sumX / cells.length, center[1] - sumY / cells.length);
	return cells.reduce((nearest, cell) => (distance(cell) < distance(nearest) ? cell : nearest));
}

/** Uses the occupied parcel nearest the town centroid as the portrait opening anchor. */
export function frameOldTown(view: View, world: World, area?: OpeningArea) {
	if (!view.isPortrait()) return false;
	const cell = centralCell(world);
	return cell ? view.framePortrait(cell.center, cell.corners, area) : false;
}

/** Frames the projected desktop town at half the canvas width. */
export function frameTownSilhouette(view: View, { grid, state }: World) {
	const points: THREE.Vector3[] = [];
	for (const [id, stories] of state.stacks) {
		const cell = grid.cellsById.get(id);
		if (!cell) continue;
		for (const [x, y, z] of cell.corners) {
			points.push(new THREE.Vector3(x, z, -y));
			points.push(new THREE.Vector3(x, cell.pad + stories.length * STORY, -y));
		}
	}
	if (points.length) view.frameSilhouette(points);
}
