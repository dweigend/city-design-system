import type { Vec3 } from '../parametrik/types';
import { terrainHeight } from '../terrain';
import { TRANSIT_PARAMS, type TransitLine } from '../transit-line';
import { walkwayParts } from '../walkway';
import type { World } from './world-contract';

function stationWalk(world: World, line: TransitLine) {
	const profile = TRANSIT_PARAMS.viaduct;
	const drop = line.profile?.platformDrop ?? profile.platformDrop.default;
	const spacing = line.profile?.supportSpacing ?? profile.supportSpacing.default;
	const angle = line.stops[0].headingRad;
	// The pedestrian deck meets the terminal platforms on the shaft side of the track.
	const offset = profile.shaftOffset.default;
	const spans = Math.min(line.path.length - 1, Math.ceil(line.length / spacing));
	const points = Array.from({ length: spans + 1 }, (_, i): Vec3 => {
		const [x, y, z] = line.path[Math.round((i * (line.path.length - 1)) / spans)];
		return [x - offset * Math.sin(angle), y + offset * Math.cos(angle), z - drop];
	});
	return points.slice(1).flatMap((b, i) => {
		const a = points[i];
		const groundZ = terrainHeight(world.grid.terrain, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
		return walkwayParts([a, b], {
			id: 'city-walk/' + line.id + '/' + i,
			groundZ,
			simplifyAtCity: true
		});
	});
}

/** Projects a parallel pedestrian deck on each retained two-stop city viaduct.
 * Erasing or adjusting the rail updates its walking connection in the same redraw. */
export function cityCorridorPaths(world: World) {
	const links = world.state.city?.corridors ?? [];
	return world.lines
		.filter(
			(line) =>
				line.kind === 'viaduct' &&
				line.cellIds.length === 2 &&
				links.some(([a, b]) => a === line.cellIds[0] && b === line.cellIds[1])
		)
		.flatMap((line) => stationWalk(world, line));
}
