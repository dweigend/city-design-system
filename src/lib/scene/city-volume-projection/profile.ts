import type { Vec2, Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { CityVolume } from '../../domain/city-volume';
import type { TerrainGrid } from '../../domain/terrain-grid';
import { edgeKey, mesh, segments } from './mesh';

type Profile = CityVolume['profile'];

function inside([x, y]: Vec2, ring: readonly Vec3[]) {
	return ring.every(([ax, ay], i) => {
		const [bx, by] = ring[(i + 1) % ring.length];
		return (bx - ax) * (y - ay) > (by - ay) * (x - ax);
	});
}

export function profileMesh(
	plan: TerrainGrid,
	profile: Profile,
	toLocal: (x: number, y: number) => Vec2,
	groundHeight: (x: number, y: number) => number
) {
	const geometry = mesh();
	const nodes = mesh();
	const vertexById = new Map(plan.vertices.map(({ id, position }) => [id, position]));
	const indices = new Map<string, number>();
	const rise = (x: number, y: number): Vec3 => [
		...toLocal(x, y),
		groundHeight(x, y) + profile.height(x, y)
	];
	function vertex(id: string, x: number, y: number) {
		let i = indices.get(id);
		if (i === undefined) {
			i = geometry.positions.length / 3;
			indices.set(id, i);
			geometry.positions.push(...rise(x, y));
		}
		return i;
	}
	for (const { id, vertexIds } of plan.cells) {
		const ring = vertexIds.map((key) => required(vertexById.get(key), 'profile plan corner'));
		const center = ring.reduce<Vec2>(([x, y], [u, v]) => [x + u / 4, y + v / 4], [0, 0]);
		const sample = inside(profile.summit, ring) ? profile.summit : center;
		const hub = vertex(id, ...sample);
		const rim = ring.flatMap(([x, y], i) => {
			const j = (i + 1) % ring.length;
			const [u, v] = ring[j];
			return [
				vertex(vertexIds[i], x, y),
				vertex(edgeKey(vertexIds[i], vertexIds[j]), (x + u) / 2, (y + v) / 2)
			];
		});
		for (const [i, a] of rim.entries()) geometry.indices.push(hub, a, rim[(i + 1) % rim.length]);
		addNode(nodes, rise(...sample));
	}
	const edges = new Map<string, readonly [number, number]>();
	const { positions, indices: triangles } = geometry;
	for (let i = 0; i < triangles.length; i += 3) {
		const [a, b, c] = triangles.slice(i, i + 3);
		for (const [from, to] of [
			[a, b],
			[b, c],
			[c, a]
		] as const)
			edges.set(edgeKey(from, to), [from, to]);
	}
	return { geometry, wires: segments(positions, edges), nodes };
}

function addNode(nodes: ReturnType<typeof mesh>, [x, y, z]: Vec3) {
	const index = nodes.positions.length / 3;
	const radius = 1.65;
	nodes.positions.push(x + radius, y, z, x, y + radius, z, x - radius, y, z, x, y - radius, z);
	nodes.positions.push(x, y, z + radius, x, y, z - radius);
	for (let i = 0; i < 4; i++) {
		const a = index + i;
		const b = index + ((i + 1) % 4);
		nodes.indices.push(a, b, index + 4, b, a, index + 5);
	}
}
