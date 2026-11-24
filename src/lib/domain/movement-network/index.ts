/** Module: Indexes a weighted movement graph for route queries. */
import { isFiniteVector, type Vec3 } from '../../core/geometry';
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

// Exact arithmetic: movement positions are XYZ triples.
function position(point: Vec3): Vec3 {
	if (!isFiniteVector(point, 3)) throw new RangeError('Invalid movement XYZ position');
	return Object.freeze<Vec3>([point[0], point[1], point[2]]);
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

/** Detaches and indexes a graph for repeated route queries. Link costs must be positive and
 * at most Number.MAX_VALUE divided by the node count, so every simple route cost is finite. */
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
	const maximumCost = Number.MAX_VALUE / Math.max(1, nodes.length);
	const adjacent = new Map<string, MovementEdge<K>[]>();
	const linkIndex = index(links);
	const edges = Object.freeze(
		[...linkIndex.keys()].sort().map((id) => {
			const link = required(linkIndex.get(id), 'movement link');
			const [from, to] = link.nodeIds;
			const a = byId.get(from);
			const b = byId.get(to);
			if (!a || !b || from === to || !(link.cost > 0 && link.cost <= maximumCost))
				throw new RangeError('Invalid movement link or unsupported cost ' + id);
			const via = Object.freeze(link.via?.map(position) ?? []);
			const points = Object.freeze([a.position, ...via, b.position]);
			const supports = link.supports?.map(({ base, top }) =>
				Object.freeze({ base: position(base), top: position(top) })
			);
			const lane =
				link.lane &&
				Object.freeze({
					...link.lane,
					hierarchy: Object.freeze([...link.lane.hierarchy])
				});
			const edge = Object.freeze({
				...link,
				...(lane ? { lane } : {}),
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

/** Single-edge access objects and their configured widths. */
export {
	accessObjectParams,
	createStairObject,
	validateStairEdge,
	createWalkwayObject,
	type AccessEdge
} from './object';
