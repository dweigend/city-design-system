import type { Vec3 } from '../parametrik/types';

/** Traces each connected boundary exactly once, preserving all surveyed stations.
 * Shared endpoints must be identical. Open ends and closed circuits are supported. */
export function contours(edges: Vec3[][]) {
	const ends = new Map<string, Vec3[][]>(),
		pending = new Set(edges);
	for (const edge of edges)
		for (const p of [edge[0], edge[edge.length - 1]]) {
			const key = p.join(','),
				at = ends.get(key) ?? [];
			at.push(edge);
			ends.set(key, at);
		}
	const result: Vec3[][] = [];
	function trace(edge: Vec3[], start: Vec3) {
		const path: Vec3[] = [start];
		let next: Vec3[] | undefined = edge;
		while (next) {
			pending.delete(next);
			const forward = path[path.length - 1].join(',') === next[0].join(',');
			path.push(...(forward ? next : next.toReversed()).slice(1));
			const adjacent = ends.get(path[path.length - 1].join(',')) ?? [];
			next = adjacent.find((e) => pending.has(e));
		}
		result.push(path);
	}
	for (const group of ends.values()) {
		if (group.length !== 1 || !pending.has(group[0])) continue;
		const edge = group[0],
			p = ends.get(edge[0].join(',')) === group ? edge[0] : edge[edge.length - 1];
		trace(edge, p);
	}
	for (const e of pending) trace(e, e[0]);
	return result;
}
