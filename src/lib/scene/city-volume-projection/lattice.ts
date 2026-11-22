import type { Vec2, Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { CityLattice } from '../../domain/city-volume';
import { mesh } from './mesh';

export function latticeMesh(lattice: CityLattice, toLocal: (x: number, y: number) => Vec2) {
	const geometry = mesh();
	const positions = new Map<string, Vec3>();
	for (const {
		id,
		position: [x, y, z]
	} of lattice.nodes) {
		const position = [...toLocal(x, y), z] as const;
		positions.set(id, position);
		addNode(geometry, position);
	}
	const wires = lattice.edges.flatMap(({ from, to }) => [
		...required(positions.get(from), 'lattice joint'),
		...required(positions.get(to), 'lattice joint')
	]);
	return { geometry, wires: Object.freeze(wires) };
}

function addNode(nodes: ReturnType<typeof mesh>, [x, y, z]: Vec3) {
	const index = nodes.positions.length / 3;
	const radius = 0.68;
	nodes.positions.push(x + radius, y, z, x, y + radius, z, x - radius, y, z, x, y - radius, z);
	nodes.positions.push(x, y, z + radius, x, y, z - radius);
	for (let i = 0; i < 4; i++) {
		const a = index + i;
		const b = index + ((i + 1) % 4);
		nodes.indices.push(a, b, index + 4, b, a, index + 5);
	}
}
