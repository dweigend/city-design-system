import { distance } from '../../core/geometry';
import { memberSections, type MemberGraph } from './graph';

type Neighbor = { joint: number; member: number; slope: number; area: number };

function adjacency({ joints, members }: MemberGraph) {
	const neighbors: Neighbor[][] = joints.map(() => []);
	const indexById = new Map(joints.map(({ id }, index) => [id, index]));
	for (const [member, { from, to, section }] of members.entries()) {
		const a = indexById.get(from) as number;
		const b = indexById.get(to) as number;
		const pointA = joints[a].position;
		const pointB = joints[b].position;
		const slope = (pointA[2] - pointB[2]) / distance(pointA, pointB);
		const area = memberSections[section].areaM2;
		neighbors[a].push({ joint: b, member, slope, area });
		neighbors[b].push({ joint: a, member, slope: -slope, area });
	}
	return neighbors;
}

/** Reverse breadth-first walk from supports across level or uphill members. */
function supportDistance(graph: MemberGraph, neighbors: Neighbor[][]) {
	const hops = graph.joints.map(({ support }) => (support === 'free' ? Infinity : 0));
	const queue = hops.flatMap((distance, index) => (distance === 0 ? [index] : []));
	for (let i = 0; i < queue.length; i++) {
		const index = queue[i];
		for (const { joint, slope } of neighbors[index]) {
			if (slope > 0 || hops[joint] !== Infinity) continue;
			hops[joint] = hops[index] + 1;
			queue.push(joint);
		}
	}
	return { hops, reachable: queue };
}

/** Visits reachable joints in descending elevation and then descending support distance. */
export function gravityRoutes(graph: MemberGraph) {
	const neighbors = adjacency(graph);
	const { hops, reachable } = supportDistance(graph, neighbors);
	const order = reachable.sort(
		(a, b) =>
			graph.joints[b].position[2] - graph.joints[a].position[2] || hops[b] - hops[a] || a - b
	);
	const exits = neighbors.map((list, index) => {
		if (hops[index] === 0 || hops[index] === Infinity) return [];
		const lower = list.filter(({ slope, joint }) => slope > 0 && hops[joint] < Infinity);
		if (lower.length) return lower;
		return list.filter(({ slope, joint }) => slope === 0 && hops[joint] < hops[index]);
	});
	return { hops, order, exits };
}
