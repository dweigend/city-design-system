import { distance, measurePolygon, type Vec2 } from '../../core/geometry';
import type { Node } from './carrier';
import { planEdgeId } from './edge-path';

import { shorelineMorphLimits as limits } from './config';

/** Clips one convex carrier polygon to a single dry shoreline crossing. Adjacent cells
 * reuse the same intersection on their common edge. Later ground checks reject dry
 * chords which cross wet ground again, or cells with multiple disjoint dry sections. */
export function shoreline(signedDistance: (x: number, y: number) => number) {
	const dry = new Map<string, boolean>();
	const crossings = new Map<string, Node>();
	function isDry(node: Node) {
		if (!dry.has(node.id)) dry.set(node.id, signedDistance(...node.xy) >= 0);
		return dry.get(node.id);
	}
	function cut(land: Node, water: Node): Node {
		const id = 'shore/' + JSON.stringify([land.id, water.id].sort());
		const cached = crossings.get(id);
		if (cached) return cached;
		let inside = land.xy;
		let outside = water.xy;
		while (distance(inside, outside) > limits.clipToleranceM) {
			const mid: Vec2 = [(inside[0] + outside[0]) / 2, (inside[1] + outside[1]) / 2];
			if (signedDistance(...mid) >= 0) inside = mid;
			else outside = mid;
		}
		const first = land.id < water.id ? land : water;
		const t = distance(first.xy, inside) / distance(land.xy, water.xy);
		const node =
			distance(inside, land.xy) < limits.clipToleranceM
				? land
				: {
						id,
						xy: inside,
						shore: Object.freeze({ planEdgeId: planEdgeId(land.id, water.id), t })
					};
		crossings.set(id, node);
		return node;
	}
	return (ring: readonly Node[]) => {
		const result: Node[] = [];
		let transitions = 0;
		for (const [index, a] of ring.entries()) {
			const b = ring[(index + 1) % ring.length];
			if (isDry(a)) result.push(a);
			if (isDry(a) === isDry(b)) continue;
			const node = isDry(a) ? cut(a, b) : cut(b, a);
			if (node !== a && node !== b) result.push(node);
			transitions++;
		}
		return transitions <= 2 ? result : [];
	};
}

/** Rejects clipped slivers too narrow to support a bay. */
export function usableShoreRing(
	ring: readonly Node[],
	{ minimumEdge, minimumArea }: { minimumEdge: number; minimumArea: number }
) {
	const points = ring.map(({ xy }) => xy);
	const { area } = measurePolygon(points);
	if (area < minimumArea) return false;

	return points.every((point, i) => {
		const a = points[(i + 1) % points.length];
		const b = points[(i + points.length - 1) % points.length];
		const ax = a[0] - point[0];
		const ay = a[1] - point[1];
		const bx = b[0] - point[0];
		const by = b[1] - point[1];
		return (
			Math.hypot(ax, ay) >= minimumEdge &&
			Math.atan2(ax * by - ay * bx, ax * bx + ay * by) >= limits.clippedMinimumAngleRad &&
			points.every(
				(other) => distance(point, other) ** 2 <= limits.clippedMaximumAspectRatio * area
			)
		);
	});
}
