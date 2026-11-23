import type { Vec2, Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { CityLattice, CityTaper } from '../../domain/city-volume';
import { chordRiseMaxM, latticeJointRadiusM, uprightRunPerRise } from './constants';
import { mesh } from './mesh';

/** The drawing rank of a member: a chord on one level (by its rank, its face or a level run) is a
 * rim, a plumb member an upright, and any slant a model's own member (a diagonal, a twist or a
 * branch), which tells the lattice models apart. */
export function memberRank([ax, ay, az]: Vec3, [bx, by, bz]: Vec3, chord: boolean) {
	const rise = Math.abs(bz - az);
	if (chord || rise <= chordRiseMaxM) return 'rims';
	return Math.hypot(bx - ax, by - ay) <= uprightRunPerRise * rise ? 'uprights' : 'detail';
}

/** Joints and member wires of a lattice in local meters, by drawing rank, with the taper offset of
 * every joint vertex and wire endpoint. */
export function latticeMesh(
	lattice: CityLattice,
	toLocal: (x: number, y: number) => Vec2,
	taper: CityTaper
) {
	const geometry = mesh();
	const jointTaper: number[] = [];
	const positions = new Map<string, { point: Vec3; offset: Vec2 }>();
	for (const { id, position } of lattice.nodes) {
		const [x, y, z] = position;
		const [u, v] = toLocal(x, y);
		const [dx, dy] = taper(position);
		const [su, sv] = toLocal(x + dx, y + dy);
		const joint = { point: [u, v, z] as Vec3, offset: [su - u, sv - v] as Vec2 };
		positions.set(id, joint);
		addNode(geometry, joint.point);
		for (let i = 0; i < 6; i++) jointTaper.push(...joint.offset);
	}
	const wires = { rims: [] as number[], uprights: [] as number[], detail: [] as number[] };
	const offsets = { rims: [] as number[], uprights: [] as number[], detail: [] as number[] };
	const key = (a: string, b: string) => JSON.stringify(a < b ? [a, b] : [b, a]);
	const sides = new Set<string>();
	for (const { sideFaces } of lattice.cells) for (const id of sideFaces) sides.add(id);
	const rim = new Set<string>();
	for (const {
		id,
		corners: [a, b, c, d]
	} of lattice.faces) {
		if (!sides.has(id)) continue;
		rim.add(key(a, b));
		rim.add(key(c, d));
	}
	for (const { id, from, to, rank } of lattice.edges) {
		const a = required(positions.get(from), 'lattice joint');
		const b = required(positions.get(to), 'lattice joint');
		const chord = rank === undefined ? rim.has(id) : rank === 'chord';
		const group = memberRank(a.point, b.point, chord);
		wires[group].push(...a.point, ...b.point);
		offsets[group].push(...a.offset, ...b.offset);
	}
	return { geometry, jointTaper, wires, offsets };
}

function addNode(nodes: ReturnType<typeof mesh>, [x, y, z]: Vec3) {
	const index = nodes.positions.length / 3;
	const radius = latticeJointRadiusM;
	nodes.positions.push(x + radius, y, z, x, y + radius, z, x - radius, y, z, x, y - radius, z);
	nodes.positions.push(x, y, z + radius, x, y, z - radius);
	for (let i = 0; i < 4; i++) {
		const a = index + i;
		const b = index + ((i + 1) % 4);
		nodes.indices.push(a, b, index + 4, b, a, index + 5);
	}
}
