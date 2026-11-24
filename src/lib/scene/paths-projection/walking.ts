import {
	createStairObject,
	createWalkwayObject,
	type AccessEdge,
	type MovementNetwork,
	type MovementRoute
} from '../../domain/movement-network';
import { defaults } from '../../../config/paths-projection';
import { appendParts, assembly, local, trace, up } from './assembly';
import { pathSurfaces } from './surfaces';
import type { MovementDrawing, PathsFrame } from './types';

function localSupports(frame: PathsFrame, supports: AccessEdge['supports'] = []) {
	return supports.map(({ base, top }) => ({ base: local(frame, base), top: local(frame, top) }));
}

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
			case 'ground':
				break;
			case 'trace':
				trace(lane.stroke, points, defaults.groundOverlayLiftM);
				break;
			case 'bridge':
				appendParts(createWalkwayObject({ id: edge.id, points }, defaults.bridgeWidthM), {
					deck: bridge.body
				});
				trace(bridge.stroke, points, defaults.lineLiftM);
				break;
			case 'deck': {
				const unique = (edge.supports ?? []).filter((bearing) => {
					const id = bearing.base.join('/') + ':' + bearing.top.join('/');
					if (bearings.has(id)) return false;
					bearings.add(id);
					return true;
				});
				const object = createWalkwayObject({
					id: edge.id,
					points,
					supports: localSupports(frame, unique)
				});
				appendParts(object, { deck: deck.body, bearing: supports.body });
				trace(deck.stroke, points, defaults.lineLiftM);
				break;
			}
			case 'stairs': {
				const object = createStairObject({
					id: edge.id,
					points,
					supports: localSupports(frame, edge.supports)
				});
				appendParts(object, { stairs: stairs.body, bearing: supports.body });
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
		const lift =
			role === 'trace' || role === 'ground' ? defaults.groundOverlayLiftM : defaults.lineLiftM;
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
