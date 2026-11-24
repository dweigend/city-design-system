import type { Vec3 } from '../../core/geometry';
import type { MovementLink, MovementNode } from '../../domain/movement-network';
import { defaults } from '../../../config/city-movement';

/** The movement roles supplied by the city adapter. */
export type CityMovementKind = 'lane' | 'bridge' | 'stair' | 'walkway';
export type Link = MovementLink<CityMovementKind>;

export function link(
	id: string,
	kind: CityMovementKind,
	a: MovementNode,
	b: MovementNode,
	via: readonly Vec3[] = [],
	supports?: Link['supports']
): Link {
	const points = [a.position, ...via, b.position];
	let cost = 0;
	for (let i = 1; i < points.length; i++) {
		const [x, y, z] = points[i];
		const [u, v, w] = points[i - 1];
		cost += Math.hypot(x - u, y - v, z - w);
	}
	return {
		id,
		kind,
		nodeIds: [a.id, b.id],
		cost: kind === 'stair' ? cost * defaults.stairCostRatio : cost,
		via,
		...(supports ? { supports } : {})
	};
}

export function support(base: MovementNode, top: MovementNode) {
	return { base: base.position, top: top.position };
}

export function raised(node: MovementNode, level: number, z: number): MovementNode {
	return {
		id: 'level/' + level + '/' + node.id,
		level,
		position: [node.position[0], node.position[1], z]
	};
}
