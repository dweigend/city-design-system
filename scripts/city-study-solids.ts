import type { Vec3 } from '../src/lib/core/geometry';
import { required } from '../src/lib/core/invariant';
import { latticeVolumes, type CityLattice } from '../src/lib/domain/city-volume';

function cyclicKey(face: readonly string[]) {
	const start = face.reduce((least, id, i) => (id < face[least] ? i : least), 0);
	return JSON.stringify([...face.slice(start), ...face.slice(0, start)]);
}

function side([x, y]: Vec3, [u, v]: Vec3, [a, b]: Vec3) {
	return (u - x) * (b - y) - (v - y) * (a - x);
}

function crosses(a: Vec3, b: Vec3, c: Vec3, d: Vec3) {
	return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

function foldedCap(face: readonly string[], positions: ReadonlyMap<string, Vec3>) {
	if (face.length < 4) return false;
	const ring = face.map((id) => required(positions.get(id), 'solid joint'));
	if (ring.some(([, , z]) => z !== ring[0][2])) return false;
	for (const [i, a] of ring.entries()) {
		const b = ring[(i + 1) % ring.length];
		for (let j = i + 2; j < ring.length - Number(i === 0); j++)
			if (crosses(a, b, ring[j], ring[(j + 1) % ring.length])) return true;
	}
	return false;
}

/** Checks oriented closure, shared faces, volume and bay ownership. */
export function solidMetrics(lattice: CityLattice) {
	let openSolids = 0;
	let faceConflicts = 0;
	let foldedCaps = 0;
	const positions = new Map(lattice.nodes.map(({ id, position }) => [id, position]));
	const uses = new Map<string, { loop: string; count: number }>();
	const solidEdges = new Set<string>();
	const bays = new Set(lattice.cells.map(({ id }) => id));
	const occupied = new Set<string>();
	let orphanSolids = 0;
	for (const { bay, faces } of lattice.solids) {
		occupied.add(bay);
		orphanSolids += +!bays.has(bay);
		const edges = new Map<string, { count: number; balance: number }>();
		for (const face of faces) {
			const key = JSON.stringify([...face].sort());
			const previous = uses.get(key);
			if (!previous) {
				uses.set(key, { loop: cyclicKey(face), count: 1 });
				foldedCaps += +foldedCap(face, positions);
			} else {
				previous.count++;
				if (previous.count !== 2 || previous.loop !== cyclicKey([...face].reverse()))
					faceConflicts++;
			}
			for (const [i, a] of face.entries()) {
				const b = face[(i + 1) % face.length];
				const forward = a < b;
				const edge = JSON.stringify(forward ? [a, b] : [b, a]);
				const incidence = edges.get(edge) ?? { count: 0, balance: 0 };
				incidence.count++;
				incidence.balance += forward ? 1 : -1;
				edges.set(edge, incidence);
				solidEdges.add(edge);
			}
		}
		for (const { count, balance } of edges.values()) {
			if (count === 2 && balance === 0) continue;
			openSolids++;
			break;
		}
	}
	const volumes = latticeVolumes(lattice);
	return {
		solids: lattice.solids.length,
		openSolids,
		faceConflicts,
		foldedCaps,
		orphanSolids,
		missingSolids: lattice.cells.length - occupied.size,
		looseMembers: lattice.edges.filter(({ id }) => !solidEdges.has(id)).length,
		minVolume: volumes.reduce((min, volume) => Math.min(min, volume), Infinity),
		volumeKm3: volumes.reduce((sum, volume) => sum + volume, 0) / 1e9
	};
}
