import { defaults } from '../../../config/city-volume';
import type { Vec3 } from '../../core/geometry';
import { createMeshObject, mesh, squareSegment } from '../../core/mesh';
import { required } from '../../core/invariant';
import { fanTriangles } from './foundation-prism';
import type { CityLattice } from './frame';
import type { LatticePoint } from './foundation';
import type { LatticeBay } from './bay-addresses';
import type { LatticeSolid } from './solid';

const normal: Vec3 = /* Exact arithmetic: positive Z axis. */ [0, 0, 1];

type Edge = CityLattice['edges'][number];
type Ordered<T> = Readonly<{ value: T; order: number }>;
type BayGeometry = Readonly<{
	solids: readonly LatticeSolid[];
	joints: ReadonlyMap<string, LatticePoint>;
	members: readonly Edge[];
}>;

function indexJoints(lattice: CityLattice, bays: ReadonlyMap<string, LatticeBay>) {
	const joints = new Map<string, Ordered<LatticePoint>>();
	const localJoints = new Map<string, string[]>();
	const register = (joint: LatticePoint) =>
		joints.set(joint.id, { value: joint, order: joints.get(joint.id)?.order ?? joints.size });
	for (const joint of lattice.bayCorners) register(joint);
	for (const joint of lattice.nodes) {
		register(joint);
		// Model joints addressed beneath a bay belong to that bay even without a solid face.
		for (
			let slash = joint.id.indexOf('/');
			slash !== -1;
			slash = joint.id.indexOf('/', slash + 1)
		) {
			const prefix = joint.id.slice(0, slash);
			if (bays.has(prefix)) append(localJoints, prefix, joint.id);
		}
	}
	return { joints, localJoints };
}

function bayJointIds(
	bay: LatticeBay,
	solids: readonly LatticeSolid[],
	faceCorners: ReadonlyMap<string, readonly string[]>,
	localJoints: readonly string[] | undefined
) {
	const ids = new Set(localJoints);
	for (const { faces } of solids) for (const face of faces) for (const id of face) ids.add(id);
	for (const face of [bay.floorFace, bay.ceilingFace, ...bay.sideFaces])
		for (const id of faceCorners.get(face) ?? []) ids.add(id);
	return ids;
}

function indexBays(lattice: CityLattice) {
	const bays = new Map(lattice.cells.map((bay) => [bay.id, bay]));
	const solidGroups = new Map<string, LatticeSolid[]>();
	const faceCorners = new Map(lattice.faces.map(({ id, corners }) => [id, corners]));
	const { joints, localJoints } = indexJoints(lattice, bays);
	const outgoing = new Map<string, Ordered<Edge>[]>();
	for (const solid of lattice.solids) append(solidGroups, solid.bay, solid);
	for (const [order, edge] of lattice.edges.entries())
		append(outgoing, edge.from, { value: edge, order });

	function readGeometry(bay: LatticeBay): BayGeometry {
		const solids = solidGroups.get(bay.id) ?? [];
		const ids = bayJointIds(bay, solids, faceCorners, localJoints.get(bay.id));
		const orderedJoints = [];
		const members = [];
		for (const id of ids) {
			const joint = joints.get(id);
			if (!joint) continue;
			orderedJoints.push(joint);
			for (const entry of outgoing.get(id) ?? [])
				if (ids.has(entry.value.to) && joints.has(entry.value.to)) members.push(entry);
		}
		// Keep the original lattice traversal order for mesh parts, triangles and anchors.
		orderedJoints.sort(byOrder);
		members.sort(byOrder);
		return {
			solids,
			joints: new Map(orderedJoints.map(({ value }) => [value.id, value])),
			members: members.map(({ value }) => value)
		};
	}

	const geometries = new Map<string, BayGeometry>();
	return (id: string) => {
		const cached = geometries.get(id);
		if (cached) return cached;
		const bay = bays.get(id);
		if (!bay) throw new RangeError(`Unknown lattice bay "${id}"`);
		const geometry = readGeometry(bay);
		geometries.set(id, geometry);
		return geometry;
	};
}

function append<T>(map: Map<string, T[]>, id: string, value: T) {
	let values = map.get(id);
	if (!values) map.set(id, (values = []));
	values.push(value);
}

const byOrder = (a: Ordered<unknown>, b: Ordered<unknown>) => a.order - b.order;
const bayIndexes = new WeakMap<CityLattice, ReturnType<typeof indexBays>>();

function bayGeometry(lattice: CityLattice, id: string) {
	let index = bayIndexes.get(lattice);
	if (!index) {
		index = indexBays(lattice);
		bayIndexes.set(lattice, index);
	}
	return index(id);
}

/** Reads the owned solids, addressed joints and member connections of one lattice bay. */
export function readLatticeBay(lattice: CityLattice, id: string) {
	const { solids, joints, members } = bayGeometry(lattice, id);
	return { solids: [...solids], joints: new Map(joints), members: [...members] };
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
	const bay = bayGeometry(lattice, id);
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
