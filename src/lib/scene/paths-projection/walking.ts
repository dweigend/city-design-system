import type { MovementNetwork, MovementRoute } from '../../domain/movement-network';
import { defaults } from '../../../config/paths-projection';
import { assembly, local, trace, up } from './assembly';
import { drawStair } from './stair';
import { pathSurfaces } from './surfaces';
import type { MovementDrawing, PathsFrame } from './types';

export function paths<K extends string>(
	network: MovementNetwork<K>,
	kinds: Readonly<Record<K, MovementDrawing>>,
	frame: PathsFrame
) {
	const drawing = assembly('movement', frame);
	const lane = drawing.layer('ground-lanes', pathSurfaces.lane);
	const bridge = drawing.layer('path-bridges', pathSurfaces.deck);
	const deck = drawing.layer('path-walkways', pathSurfaces.deck);
	const supports = drawing.layer('path-supports', pathSurfaces.support);
	const stairs = drawing.layer('path-stairs', pathSurfaces.deck);
	const bearings = new Set<string>();
	for (const edge of network.edges) {
		const points = edge.points.map((point) => local(frame, point));
		const role = kinds[edge.kind];
		switch (role) {
			case 'trace':
				trace(lane.stroke, points, defaults.groundOverlayLiftM);
				break;
			case 'bridge':
				bridge.body.ribbon(points, defaults.bridgeWidthM, defaults.deckThicknessM);
				trace(bridge.stroke, points, defaults.lineLiftM);
				break;
			case 'deck':
				deck.body.ribbon(points, defaults.walkwayWidthM, defaults.deckThicknessM);
				trace(deck.stroke, points, defaults.lineLiftM);
				for (const bearing of edge.supports ?? []) {
					const id = bearing.base.join('/') + ':' + bearing.top.join('/');
					if (bearings.has(id)) continue;
					bearings.add(id);
					const base = local(frame, bearing.base);
					supports.body.pier(base, bearing.top[2], defaults.walkwayPierRadiusM);
				}
				break;
			case 'stairs': {
				drawStair(stairs.body, points);
				const floor = Math.min(points[0][2], points[points.length - 1][2]);
				for (const point of points.slice(1, -1)) {
					supports.body.pier([point[0], point[1], floor], point[2], defaults.walkwayPierRadiusM);
				}
				break;
			}
		}
	}
	return drawing.complete(
		network.nodes.map(({ id, position }) => ({
			name: id,
			position: local(frame, position),
			normal: up
		}))
	);
}

export function highlight<K extends string>(
	network: MovementNetwork<K>,
	route: MovementRoute<K> | undefined,
	kinds: Readonly<Record<K, MovementDrawing>>,
	frame: PathsFrame
) {
	const drawing = assembly('movement-route', frame);
	const layer = drawing.layer('path-route', pathSurfaces.route);
	for (const edge of route?.edges ?? []) {
		const role = kinds[edge.kind];
		const lift = role === 'trace' ? defaults.groundOverlayLiftM : defaults.lineLiftM;
		trace(
			layer.stroke,
			edge.points.map((point) => local(frame, point)),
			lift + defaults.lineLiftM
		);
	}
	if (route) {
		for (const id of [route.nodes[0], route.nodes[route.nodes.length - 1]]) {
			const node = network.readNode(id);
			if (!node) continue;
			const [x, y, z] = local(frame, node.position);
			layer.body.pier([x, y, z], z + defaults.lineLiftM * 2, defaults.routeEndpointRadiusM);
		}
	}
	return drawing.complete();
}
