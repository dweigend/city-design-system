import { dockBoundsOverlap, type Bounds } from '../megastructure';
import { position, rodOf, savedSocket } from './installation-parts';
import { socketBounds } from '../house-brush';
import { buildingPlots } from './building-plots';
import { WALKWAY_WIDTH_M } from '../walkway';
import type { World } from './world-contract';
import type { TerrainCell } from '../terrain-grid';
import type { Vec3 } from '../parametrik/types';

function bounds(points: readonly Vec3[], margin: number): Bounds {
	const axis = (i: number) => points.map((p) => p[i]);
	return {
		min: [0, 1, 2].map((i) => Math.min(...axis(i)) - margin) as Vec3,
		max: [0, 1, 2].map((i) => Math.max(...axis(i)) + margin) as Vec3
	};
}
/** Conservative world boxes cover the full two approach cells up to the underside of a gate. */
export function gateBlocker(world: World, roads: TerrainCell[], crown: number, seam: string) {
	const volumes = roads.map((road) => {
		const box = bounds(road.corners, 0);
		box.max[2] = crown;
		return box;
	});
	const plots = buildingPlots(world.grid);
	for (const part of world.state.parts.values()) {
		if (part.kind === 'segment' && part.frame?.seam === seam) continue;
		let boxes: Bounds[];
		if (part.kind === 'module') {
			const support = world.state.parts.get(part.attachedTo),
				rod = support && rodOf(plots, support);
			const seat = rod && savedSocket(rod, part, world.seed);
			if (!seat) {
				if (roads.some((road) => road.id === part.anchor.cellId)) return part.id;
				continue;
			}
			boxes = socketBounds(seat);
		} else {
			const rod = rodOf(plots, part);
			const a = rod?.a ?? position(plots, part.anchor);
			const b = rod?.b ?? (part.kind === 'segment' ? position(plots, part.end) : a);
			const radius =
				part.recipe === 'plaza'
					? WALKWAY_WIDTH_M
					: part.kind === 'segment'
						? (rodOf(plots, part)?.radius ?? WALKWAY_WIDTH_M / 2)
						: WALKWAY_WIDTH_M / 2;
			boxes = [bounds([a, b], radius)];
		}
		if (volumes.some((volume) => boxes.some((box) => dockBoundsOverlap(volume, box))))
			return part.id;
	}
}

/** Returns conservative docking obstacles for the full clear volume under each installed span. */
export function reservedFrameVolumes(world: World): Bounds[] {
	return [...(world.state.frameInstallations?.values() ?? [])].flatMap(({ bay, result }) => {
		if (result.status !== 'sized') return [];
		return (bay.clearVolumes ?? []).map((v) => {
			const box = bounds(
				v.polygon.map(([x, y]) => [x, y, v.z]),
				0
			);
			box.max[2] = v.z + v.hoeheM;
			return box;
		});
	});
}
