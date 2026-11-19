import { houseStair } from '../../data/house-stair';
import { buildObject, type ObjectGeometry } from '../assets';
import { routeDecks, spanSurvey, walkwayParts } from '../walkway';
import { distance, mix } from './clearance';
import { plan } from './deck-route';
import { isPlaza } from './graph';
import {
	width,
	type Edge,
	type Network,
	type NetworkInput,
	type Point,
	type Position
} from './types';

function stairTreads(edge: Edge, seed: number) {
	const [a, b] = edge.points,
		from = plan(a),
		to = plan(b);
	const run = distance(from, to),
		count = Math.round(run / houseStair.going);
	const cos = (b[0] - a[0]) / run,
		sin = (b[1] - a[1]) / run;
	return Array.from({ length: count }, (_, i) => {
		const id = edge.id + '/tread/' + i;
		const [stock] = buildObject('stairs', 'straight-tread', seed, { instanceId: id }).geometry;
		if (stock.kind !== 'prism') throw new Error('Expected registry tread plate');
		const [x, y] = mix(from, to, (i + 0.5) / count);
		const polygon = stock.polygon.map(([u, v]): Point => [
			x + u * cos - v * sin,
			y + u * sin + v * cos
		]);
		return {
			...stock,
			slot: 'access',
			polygon,
			z: a[2] + ((b[2] - a[2]) * (i + 1)) / count - stock.height
		};
	});
}
function projectedSpan(
	e: Edge,
	i: number,
	ring: ReturnType<typeof routeDecks>[number],
	input: NetworkInput
) {
	const id = e.id + '/' + i,
		a = e.points[i],
		b = e.points[i + 1];
	const parts: ObjectGeometry[] = [];
	if (e.kind === 'deck') {
		const midpoint = mix(plan(a), plan(b), 0.5);
		for (const part of walkwayParts([a, b], { id, width, groundZ: input.terrain(...midpoint) })) {
			const { id: partId, role } = part;
			if (part.kind === 'cylinder')
				parts.push({
					id: partId,
					role,
					kind: part.kind,
					slot: 'frame',
					position: part.position,
					radius: part.radius,
					height: part.height
				});
			if (part.kind === 'prism')
				parts.push({
					id: partId,
					role,
					kind: part.kind,
					slot: 'access',
					polygon: part.polygon,
					z: part.z,
					height: part.height
				});
			if (part.kind === 'polyline')
				parts.push({ id: partId, role, kind: part.kind, slot: 'frame', points: part.points });
		}
		return parts;
	}
	if (e.kind !== 'stair')
		parts.push({
			id,
			kind: 'mesh',
			role: 'neu',
			slot: 'access',
			points: ring,
			triangles: [0, 2, 1, 0, 3, 2],
			lines: [[0, 1, 2, 3, 0]]
		});
	if (e.kind !== 'ground') {
		const { rails } = spanSurvey(ring, id, width);
		for (const rail of rails) parts.push({ ...rail, kind: 'polyline', role: 'neu', slot: 'frame' });
	}
	return parts;
}
export function project(network: Omit<Network, 'geometry'>, input: NetworkInput, seed: number) {
	const parts = network.edges.flatMap((e) => {
		const rings = routeDecks(e.points, width);
		const spans = rings.flatMap((ring, i) => projectedSpan(e, i, ring, input));
		return e.kind === 'stair' ? [...spans, ...stairTreads(e, seed)] : spans;
	});
	for (const n of network.nodes.filter(isPlaza)) {
		const position: Position = [n.position[0], n.position[1], n.position[2] - 0.08];
		parts.push({
			kind: 'cylinder',
			id: 'plaza/' + n.id,
			position,
			radius: width / 2,
			height: 0.08,
			slot: 'deck',
			role: 'neu'
		});
	}
	return parts;
}
