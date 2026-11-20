import type { Primitive } from '../../logic/parametrik/types';
import { frameDesktopCourts } from './desktop-opening';
import { courtOpening } from './court-opening';
import { Vector3 } from 'three/webgpu';
import { bankDistance, valleyCoords, valleyPoint } from '../../logic/terrain';
import { STORY } from '../../data/grid';
import type { World } from '../../logic/sandbox';
import type { OpeningArea, View } from './view';

// Use the central two thirds of occupied parcels. A distant installation cannot dictate the opening zoom.
function townCluster({ grid, state }: World, portrait = false) {
	const parcels = [...state.stacks].flatMap(([id, stories]) => {
		const cell = grid.cellsById.get(id);
		return cell ? [{ cell, stories: stories.length }] : [];
	});
	if (!parcels.length) return;
	const center = new Vector3();
	for (const { cell } of parcels) center.add(new Vector3(...cell.center));
	center.divideScalar(parcels.length);
	const { terrain } = grid;
	const [along, across] = valleyCoords(terrain, center.x, center.y);
	const [bx, by] = valleyPoint(
		terrain,
		along,
		across - bankDistance(terrain, center.x, center.y) - 2
	);
	const water = grid.cells.filter((cell) => cell.zone === 'water').map((cell) => cell.center);
	const distance = ({ cell }: (typeof parcels)[number]) =>
		Math.hypot(cell.center[0] - center.x, cell.center[1] - center.y);
	parcels.sort((a, b) => distance(a) - distance(b));
	const count = Math.ceil(parcels.length * (portrait ? 0.5 : 2 / 3));
	const district = parcels.slice(0, count);
	const points = district.flatMap(({ cell, stories }) =>
		cell.corners.flatMap(([x, y, z]) => [
			new Vector3(x, z, -y),
			new Vector3(x, cell.pad + stories * STORY, -y)
		])
	);
	if (parcels.length > 3) {
		center.x += (bx - center.x) * 0.31;
		center.y += (by - center.y) * 0.31;
	}
	const [x, y, z] = parcels.reduce((best, p) => (distance(p) < distance(best) ? p : best)).cell
		.center;
	return { points, water, anchor: new Vector3(x, z, -y) };
}

function frameCourts(
	view: View,
	world: World,
	area?: OpeningArea,
	additions?: readonly Primitive[]
) {
	const courts = courtOpening(world, view.isPortrait());
	if (!courts) return false;
	if (view.isPortrait()) view.frameSilhouette(courts.points, undefined, area, [], courts.heading);
	else frameDesktopCourts(view, world, courts, area, additions);
	return true;
}

/** Fits the occupied neighbourhood around the central editable parcel between the phone controls. */
export function frameOldTown(view: View, world: World, area?: OpeningArea) {
	if (!view.isPortrait()) return false;
	if (frameCourts(view, world, area)) return true;
	const cluster = townCluster(world, true);
	if (!cluster) return false;
	view.frameSilhouette(cluster.points, cluster.anchor, area, cluster.water);
	return true;
}

/** Fits the central occupied town footprint, including its building heights. */
export function frameTownSilhouette(
	view: View,
	world: World,
	area?: OpeningArea,
	additions?: readonly Primitive[]
) {
	if (frameCourts(view, world, area, additions)) return true;
	const cluster = townCluster(world);
	if (!cluster) return false;
	view.frameSilhouette(cluster.points, undefined, area, cluster.water);
	return true;
}
