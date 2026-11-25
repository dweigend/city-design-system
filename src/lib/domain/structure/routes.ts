import { distance } from '../../core/geometry';
import { readMemberSection, type MemberGraph } from './graph';

type Neighbor = { joint: number; member: number; slope: number; area: number; riseM: number };

function adjacency(graph: MemberGraph, indexById: ReadonlyMap<string, number>) {
	const { joints, members } = graph;
	const neighbors: Neighbor[][] = joints.map(() => []);
	for (const [member, { from, to, section }] of members.entries()) {
		const a = indexById.get(from) as number;
		const b = indexById.get(to) as number;
		const pointA = joints[a].position;
		const pointB = joints[b].position;
		const riseM = pointA[2] - pointB[2];
		const slope = riseM / distance(pointA, pointB);
		const { areaM2: area } = readMemberSection(graph, section);
		neighbors[a].push({ joint: b, member, slope, area, riseM });
		neighbors[b].push({ joint: a, member, slope: -slope, area, riseM: -riseM });
	}
	return neighbors;
}

/** Reverse breadth-first walk from supports across level or uphill members. */
function supportDistance(graph: MemberGraph, neighbors: Neighbor[][]) {
	const hops = graph.joints.map(({ support }) => (support === 'free' ? Infinity : 0));
	const queue = hops.flatMap((distance, index) => (distance === 0 ? [index] : []));
	for (let i = 0; i < queue.length; i++) {
		const index = queue[i];
		for (const { joint, riseM } of neighbors[index]) {
			if (riseM > 0 || hops[joint] !== Infinity) continue;
			hops[joint] = hops[index] + 1;
			queue.push(joint);
		}
	}
	return { hops, reachable: queue };
}

function weighted(links: readonly Neighbor[]) {
	const weight = links.reduce((sum, link) => sum + link.area, 0);
	// Scale by the largest area only when summing the supplied sections overflows.
	const scale = Number.isFinite(weight)
		? 1
		: links.reduce((max, { area }) => Math.max(max, area), 0);
	const total = scale === 1 ? weight : links.reduce((sum, { area }) => sum + area / scale, 0);
	return links.map(({ joint, member, slope, area }) => ({
		joint,
		member,
		slope,
		share: area / scale / total
	}));
}

/** Visits reachable joints in descending elevation and then descending support distance. */
export function gravityRoutes(graph: MemberGraph) {
	const jointIndices = new Map(graph.joints.map(({ id }, index) => [id, index]));
	const neighbors = adjacency(graph, jointIndices);
	const { hops, reachable } = supportDistance(graph, neighbors);
	const order = reachable.sort(
		(a, b) =>
			graph.joints[b].position[2] - graph.joints[a].position[2] || hops[b] - hops[a] || a - b
	);
	const exits = neighbors.map((list, index) => {
		if (hops[index] === 0 || hops[index] === Infinity) return [];
		const lower = list.filter(({ riseM, joint }) => riseM > 0 && hops[joint] < Infinity);
		if (lower.length) return weighted(lower);
		return weighted(list.filter(({ riseM, joint }) => riseM === 0 && hops[joint] < hops[index]));
	});
	return { hops, order, exits, jointIndices };
}
