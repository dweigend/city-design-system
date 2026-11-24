import type { Vec2, Vec3 } from '../../lib/core/geometry';
import {
	cityRailCatchmentSpacingM,
	cityRailTerrainSlopeBound,
	type readCityMovement,
	type readCityRail,
	type CityRailOptions
} from '../../lib/world/city-movement';
import { readCitySide, type CityGrid, type CitySite } from '../../lib/world/city-site';

export function crossingHeads(layout: CityGrid): readonly string[] {
	return layout.selectedCrossings[0]?.heads.map(({ nodeId }) => nodeId) ?? [];
}

export function railDemo(
	site: CitySite,
	layout: CityGrid,
	heads: readonly string[]
): CityRailOptions {
	const head = layout.grid.vertices.find(({ id }) => id === heads[0]);
	const center: Vec2 = head ? [head.position[0], head.position[1]] : site.origin;
	const { bearing } = site.frame;
	const half = cityRailCatchmentSpacingM / 2;
	const surface = ([x, y]: Vec2) => {
		const ground = site.sampleGround(x, y);
		return Math.max(ground.height, ground.waterHeight ?? -Infinity);
	};
	return {
		center,
		catchments: [
			{
				id: 'upstream',
				center: [center[0] - Math.cos(bearing) * half, center[1] - Math.sin(bearing) * half]
			},
			{
				id: 'downstream',
				center: [center[0] + Math.cos(bearing) * half, center[1] + Math.sin(bearing) * half]
			}
		],
		// The regional demo models terrain and water with a configured grade envelope.
		readSpanUpperM(a, b) {
			const midpoint: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
			const nearestProbeM = Math.hypot(b[0] - a[0], b[1] - a[1]) / 4;
			return (
				Math.max(surface(a), surface(b), surface(midpoint)) +
				nearestProbeM * cityRailTerrainSlopeBound
			);
		}
	};
}

/** Picks a connected parcel portal on the opposite bank from the station nearest the crossing. */
export function portalRoute(
	site: CitySite,
	movement: ReturnType<typeof readCityMovement>,
	rail: ReturnType<typeof readCityRail>,
	heads: readonly string[]
) {
	const { network, portalNodeIds } = movement;
	const points = heads.flatMap((id) => {
		const node = network.readNode('ground/' + id);
		return node ? [node.position] : [];
	});
	const [center = site.origin] = points;
	const distance = ([x, y]: Vec2, [u, v]: Vec2) => Math.hypot(x - u, y - v);
	const portals = [...new Set(portalNodeIds.values())].flatMap((id) => {
		const node = network.readNode(id);
		if (!node) return [];
		const [x, y] = node.position;
		return [{ id, point: [x, y] as Vec2, side: readCitySide(site, [x, y]) }];
	});
	const components = network.readComponents();
	const stations = (rail?.stations ?? [])
		.slice()
		.sort(
			(a, b) =>
				distance([a.position[0], a.position[1]], [center[0], center[1]]) -
				distance([b.position[0], b.position[1]], [center[0], center[1]])
		);
	for (const station of stations) {
		const target = 'station/' + station.id;
		const component = components.get(target);
		if (!component) continue;
		const side = readCitySide(site, [station.position[0], station.position[1]]);
		const start = points.find(([x, y]) => readCitySide(site, [x, y]) === -side) ?? center;
		const nearest = portals
			.filter(
				({ id, side: bank }) => bank !== 0 && bank === -side && components.get(id) === component
			)
			.sort(
				(a, b) => distance(a.point, [start[0], start[1]]) - distance(b.point, [start[0], start[1]])
			)[0];
		if (nearest) return network.readRoute(nearest.id, target);
	}
}

/** Finds a connected station and its closest selected crossing to frame together. */
export function dockQuarter(
	layout: CityGrid,
	movement: ReturnType<typeof readCityMovement>,
	rail: ReturnType<typeof readCityRail>
) {
	let closest = Infinity;
	let points: readonly Vec3[] | undefined;
	for (const station of rail?.stations ?? []) {
		if (!movement.network.readNode('station/' + station.id)) continue;
		const [sx, sy] = station.position;
		for (const crossing of layout.selectedCrossings) {
			const [a, b] = crossing.heads.map(({ nodeId }) =>
				movement.network.readNode('ground/' + nodeId)
			);
			if (!a || !b) continue;
			const x = (a.position[0] + b.position[0]) / 2;
			const y = (a.position[1] + b.position[1]) / 2;
			const distance = Math.hypot(sx - x, sy - y);
			if (distance >= closest) continue;
			closest = distance;
			points = [a.position, b.position, station.position];
		}
	}
	return points;
}
