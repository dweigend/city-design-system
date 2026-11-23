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
	const wires = { rims: [] as number[], uprights: [] as number[], detail: [] as number[] };
	const key = (a: string, b: string) => JSON.stringify(a < b ? [a, b] : [b, a]);
	const rim = new Set<string>();
	const upright = new Set<string>();
	for (const {
		corners: [a, b, c, d]
	} of lattice.faces) {
		rim.add(key(a, b));
		rim.add(key(c, d));
		upright.add(key(b, c));
		upright.add(key(d, a));
	}
	for (const { id, from, to } of lattice.edges) {
		const group = rim.has(id) ? wires.rims : upright.has(id) ? wires.uprights : wires.detail;
		group.push(
			...required(positions.get(from), 'lattice joint'),
			...required(positions.get(to), 'lattice joint')
		);
	}
	return { geometry, wires };
}

function addNode(nodes: ReturnType<typeof mesh>, [x, y, z]: Vec3) {
	const index = nodes.positions.length / 3;
	const radius = 0.92;
	nodes.positions.push(x + radius, y, z, x, y + radius, z, x - radius, y, z, x, y - radius, z);
	nodes.positions.push(x, y, z + radius, x, y, z - radius);
	for (let i = 0; i < 4; i++) {
		const a = index + i;
		const b = index + ((i + 1) % 4);
		nodes.indices.push(a, b, index + 4, b, a, index + 5);
	}
}
