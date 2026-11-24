import { defaults } from '../../../config/city-volume';
import type { Vec3 } from '../../core/geometry';
import { createMeshObject, mesh, squareSegment } from '../../core/mesh';
import { required } from '../../core/invariant';
import { fanTriangles } from './foundation-prism';
import type { CityLattice } from './frame';
import type { LatticePoint } from './foundation';
import type { LatticeSolid } from './solid';

const normal: Vec3 = [0, 0, 1];

/** Reads the owned solids, addressed joints and member connections of one lattice bay. */
export function readLatticeBay(lattice: CityLattice, id: string) {
	const bay = lattice.cells.find((cell) => cell.id === id);
	if (!bay) throw new RangeError(`Unknown lattice bay "${id}"`);
	const solids = lattice.solids.filter(({ bay }) => bay === id);
	const faceIds = new Set([bay.floorFace, bay.ceilingFace, ...bay.sideFaces]);
	const jointIds = new Set([
		...solids.flatMap(({ faces }) => faces.flat()),
		...lattice.faces.filter((face) => faceIds.has(face.id)).flatMap(({ corners }) => corners)
	]);
	for (const node of lattice.nodes) if (node.id.startsWith(id + '/')) jointIds.add(node.id);
	const joints = new Map<string, LatticePoint>();
	for (const joint of [...lattice.bayCorners, ...lattice.nodes])
		if (jointIds.has(joint.id)) joints.set(joint.id, joint);
	const members = lattice.edges.filter(({ from, to }) => joints.has(from) && joints.has(to));
	return { solids, joints, members };
}

// Exact arithmetic: the vertex table stores packed XYZ triples, independently for each solid.
function solidShape({ faces }: LatticeSolid, joints: ReadonlyMap<string, LatticePoint>) {
	const positions: number[] = [];
	const indices: number[] = [];
	const vertices = new Map<string, number>();
	for (const face of faces) {
		const ring = face.map((id) => required(joints.get(id), 'solid joint'));
		for (const triangle of fanTriangles(ring)) {
			for (const { id, position } of triangle) {
				let index = vertices.get(id);
				if (index === undefined) {
					index = positions.length / 3;
					vertices.set(id, index);
					positions.push(...position);
				}
				indices.push(index);
			}
		}
	}
	return { kind: 'mesh' as const, positions, indices };
}

/** Builds one addressed bay with canonical solid faces, member profiles and joint anchors. */
export function createLatticeBayObject(lattice: CityLattice, id: string) {
	const bay = readLatticeBay(lattice, id);
	const solids = mesh();
	for (const solid of bay.solids) solids.append(solidShape(solid, bay.joints));
	const members = mesh();
	for (const { from, to } of bay.members) {
		const a = required(bay.joints.get(from), 'member start');
		const b = required(bay.joints.get(to), 'member end');
		if (a.position.some((value, axis) => value !== b.position[axis]))
			members.append(squareSegment(a.position, b.position, defaults.bayMemberWidthM));
	}
	const anchors = Array.from(bay.joints.values(), ({ id, position }) => ({
		name: id,
		position,
		normal
	}));
	return createMeshObject(id, { solid: solids, member: members }, anchors);
}
