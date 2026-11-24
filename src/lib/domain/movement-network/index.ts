import type { Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { shortest } from './route';

import type { MovementEdge, MovementLink, MovementNetwork, MovementNode } from './types';
export type {
	MovementEdge,
	MovementLink,
	MovementNetwork,
	MovementNode,
	MovementRoute
} from './types';

function index<T extends { id: string }>(items: readonly T[]) {
	const byId = new Map(items.map((item) => [item.id, item]));
	if (byId.has('') || byId.size !== items.length) throw new RangeError('Invalid movement IDs');
	return byId;
}

function position(point: Vec3): Vec3 {
	if (!point.every(Number.isFinite)) throw new RangeError('Invalid movement position');
	return Object.freeze([...point] as Vec3);
}

function measure(points: readonly Vec3[]) {
	let lengthM = 0;
	for (let i = 1; i < points.length; i++) {
		const [x, y, z] = points[i];
		const [a, b, c] = points[i - 1];
		lengthM += Math.hypot(x - a, y - b, z - c);
	}
	return lengthM;
}

function readComponents<K extends string>(
	ids: Iterable<string>,
	adjacent: ReadonlyMap<string, readonly MovementEdge<K>[]>
) {
	const components = new Map<string, string>();
	for (const first of [...ids].sort()) {
		if (components.has(first)) continue;
		const pending = [first];
		components.set(first, first);
		for (const id of pending) {
			for (const edge of adjacent.get(id) ?? []) {
				for (const next of edge.nodeIds) {
					if (components.has(next)) continue;
					components.set(next, first);
					pending.push(next);
				}
			}
		}
	}
	return components;
}

/** Detaches and validates a graph and indexes its edges once for repeated route queries. */
export function createMovementNetwork<K extends string>(
	inputNodes: readonly MovementNode[],
	links: readonly MovementLink<K>[]
): MovementNetwork<K> {
	const nodes = Object.freeze(
		inputNodes.map((node) => {
			if (node.level !== 'ground' && !Number.isInteger(node.level))
				throw new RangeError('Movement levels must be integer addresses or ground');
			return Object.freeze({ ...node, position: position(node.position) });
		})
	);
	const byId = index(nodes);
	const adjacent = new Map<string, MovementEdge<K>[]>();
	const linkIndex = index(links);
	const edges = Object.freeze(
		[...linkIndex.keys()].sort().map((id) => {
			const link = required(linkIndex.get(id), 'movement link');
			const [from, to] = link.nodeIds;
			const a = byId.get(from);
			const b = byId.get(to);
			if (!a || !b || from === to || !(link.cost > 0 && Number.isFinite(link.cost)))
				throw new RangeError('Invalid movement link ' + id);
			const via = Object.freeze(link.via?.map(position) ?? []);
			const points = Object.freeze([a.position, ...via, b.position]);
			const supports = link.supports?.map(({ base, top }) =>
				Object.freeze({ base: position(base), top: position(top) })
			);
			const edge = Object.freeze({
				...link,
				via,
				...(supports ? { supports: Object.freeze(supports) } : {}),
				nodeIds: Object.freeze([from, to] as const),
				lengthM: measure(points),
				points
			});
			for (const node of edge.nodeIds) {
				const list = adjacent.get(node) ?? [];
				list.push(edge);
				adjacent.set(node, list);
			}
			return edge;
		})
	);
	return Object.freeze({
		nodes,
		edges,
		readNode: (id: string) => byId.get(id),
		readComponents: () => readComponents(byId.keys(), adjacent),
		readRoute: (from: string, to: string) =>
			byId.has(from) && byId.has(to) ? shortest(adjacent, from, to) : undefined
	});
}
