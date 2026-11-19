import { Vector3 } from 'three/webgpu';
import { STORY } from '../../data/grid';
import type { World } from '../../logic/sandbox';
import type { OpeningArea, View } from './view';

// Use the central two thirds of occupied parcels. A distant installation cannot dictate the opening zoom.
function townCluster({ grid, state }: World) {
	const parcels = [...state.stacks].flatMap(([id, stories]) => {
		const cell = grid.cellsById.get(id);
		return cell ? [{ cell, stories: stories.length }] : [];
	});
	if (!parcels.length) return;
	const center = new Vector3();
	for (const { cell } of parcels) center.add(new Vector3(...cell.center));
	center.divideScalar(parcels.length);
	const distance = ({ cell }: (typeof parcels)[number]) =>
		Math.hypot(cell.center[0] - center.x, cell.center[1] - center.y);
	parcels.sort((a, b) => distance(a) - distance(b));
	const count = Math.ceil((parcels.length * 2) / 3);
	const district = parcels.slice(0, count);
	const points = district.flatMap(({ cell, stories }) =>
		cell.corners.flatMap(([x, y, z]) => [
			new Vector3(x, z, -y),
			new Vector3(x, cell.pad + stories * STORY, -y)
		])
	);
	const [x, y, z] = district[0].cell.center;
	return { points, anchor: new Vector3(x, z, -y) };
}

/** Fits the occupied neighbourhood around the central editable parcel between the phone controls. */
export function frameOldTown(view: View, world: World, area?: OpeningArea) {
	if (!view.isPortrait()) return false;
	const cluster = townCluster(world);
	if (!cluster) return false;
	view.frameSilhouette(cluster.points, cluster.anchor, area);
	return true;
}

/** Fits the central occupied town footprint, including its building heights. */
export function frameTownSilhouette(view: View, world: World) {
	const cluster = townCluster(world);
	if (!cluster) return false;
	view.frameSilhouette(cluster.points);
	return true;
}
