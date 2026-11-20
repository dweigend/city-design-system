import { required } from '../required';
import { contours, pathSupports, pathTube } from '../linear-path';
import { townPath } from './town-path';
import { rampSurface } from './walking-profile';
import { houseStair } from '../../data/house-stair';
import { buildObject } from '../assets';
import { routeDecks, WALKWAY_PARAMS } from '../walkway';
import { distance, mix } from './clearance';
import { plan } from './deck-route';
import { isPlaza } from './graph';
import { width, type Edge, type Network, type NetworkInput, type Position } from './types';

type Band = ReturnType<typeof townPath>['bands'][number];
function flightParts(
	{ span: { id, a, b }, right, left }: Band,
	kind: Edge['kind'],
	ground: NetworkInput['terrain'],
	seed: number
): Network['geometry'] {
	const parts: Network['geometry'] = [];
	const ring = [right[0], left[0], left[left.length - 1], right[right.length - 1]];
	if (kind === 'stair') {
		const count = Math.round(distance(plan(a), plan(b)) / houseStair.going);
		const [stock] = buildObject('stairs', 'straight-tread', seed, { instanceId: id }).geometry;
		if (stock.kind !== 'prism') throw new Error('Expected registry tread plate');
		const at = (i: number, side: number) => mix(plan(ring[side]), plan(ring[3 - side]), i / count);
		for (let i = 0; i < count; i++)
			parts.push({
				...stock,
				id: id + '/tread/' + i,
				slot: 'access',
				polygon: [at(i, 0), at(i, 1), at(i + 1, 1), at(i + 1, 0)],
				z: a[2] + ((b[2] - a[2]) * (i + 1)) / count - stock.height
			});
	} else if (kind === 'deck') {
		parts.push({
			id: id + '/deck',
			kind: 'prism',
			slot: 'access',
			role: 'neu',
			z: a[2] - WALKWAY_PARAMS.thickness.default,
			height: WALKWAY_PARAMS.thickness.default,
			polygon: [...left, ...right.toReversed()].map(plan)
		});
	} else parts.push({ ...rampSurface(right, left), id: id + '/ramp', slot: 'access', role: 'neu' });
	for (const [i, p] of pathSupports([a, b], 12).entries()) {
		const base = ground(p[0], p[1]),
			height = p[2] - base - (kind === 'deck' ? WALKWAY_PARAMS.thickness.default : 0);
		if (height > 0)
			parts.push({
				kind: 'cylinder',
				id: id + '/pier/' + i,
				slot: 'frame',
				role: 'neu',
				position: [p[0], p[1], base],
				height,
				radius: width * 0.12
			});
	}
	return parts;
}
function raisedPaths(edges: Edge[], input: NetworkInput, seed: number): Network['geometry'] {
	const kinds = new Map(edges.map((e) => [e.id, e.kind]));
	const { bands } = townPath(
		edges.map((e) => ({ id: e.id, a: e.points[0], b: e.points[e.points.length - 1] })),
		new Map(),
		width
	);
	const parts = bands.flatMap((b) =>
		flightParts(b, required(kinds.get(b.span.id), 'flight kind'), input.terrain, seed)
	);
	const sides = contours(bands.flatMap((b) => [b.left, b.right]));
	for (const [i, side] of sides.entries()) {
		const id = 'guard/' + i;
		parts.push({
			...pathTube(
				side.map(([x, y, z]) => [x, y, z + 1]),
				0.06
			),
			id,
			role: 'neu',
			slot: 'frame'
		});
		for (const [j, p] of pathSupports(side, 3).entries())
			parts.push({
				kind: 'cylinder',
				id: id + '/post/' + j,
				role: 'neu',
				slot: 'frame',
				position: p,
				height: 1,
				radius: 0.06
			});
	}
	return parts;
}
/** Projects the shared network stations in walking metres and assigns material slots. */
export function project(network: Omit<Network, 'geometry'>, input: NetworkInput, seed: number) {
	const parts: Network['geometry'] = network.edges
		.filter((e) => e.kind === 'ground')
		.flatMap((e) =>
			routeDecks(e.points, width).map((points, i) => ({
				id: e.id + '/' + i,
				kind: 'mesh' as const,
				role: 'neu' as const,
				slot: 'access' as const,
				points,
				triangles: [0, 2, 1, 0, 3, 2],
				lines: [[0, 1, 2, 3, 0]]
			}))
		);
	parts.push(
		...raisedPaths(
			network.edges.filter((e) => e.kind !== 'ground'),
			input,
			seed
		)
	);
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
