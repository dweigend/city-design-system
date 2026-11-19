import { type Bounds } from '../megastructure';
import { socketBounds, stackTop } from '../house-brush';
import { buildingPlots } from './building-plots';
import { reservedFrameVolumes } from './gate-clearance';
import { rodOf, savedSocket } from './installation-parts';
import type { World } from './world-contract';

function roofObstacles(world: World): Bounds[] {
	return [...world.state.stacks.keys()].flatMap((id) => {
		const c = buildingPlots(world.grid).cellsById.get(id);
		if (!c) return [];
		const xs = c.corners.map((p) => p[0]),
			ys = c.corners.map((p) => p[1]);
		return [
			{
				min: [Math.min(...xs), Math.min(...ys), Math.min(...c.corners.map((p) => p[2]))],
				max: [Math.max(...xs), Math.max(...ys), stackTop(world.state.stacks, c)]
			}
		];
	});
}

/** Surveys occupied roof, gate and fitting volumes alongside the carrier rods. */
export function dockStock(world: World) {
	const plots = buildingPlots(world.grid);
	const rods = [...world.state.parts.values()].flatMap((part) => rodOf(plots, part) ?? []);
	const occupied = [...roofObstacles(world), ...reservedFrameVolumes(world)];
	for (const part of world.state.parts.values()) {
		if (part.kind !== 'module') continue;
		const rod = rods.find(({ part: support }) => support.id === part.attachedTo);
		const seat = rod && savedSocket(rod, part, world.seed);
		if (seat) occupied.push(...socketBounds(seat));
	}
	return { rods, occupied };
}
