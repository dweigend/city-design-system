import { defaults } from '../../../config/city-structure';
import { required } from '../../core/invariant';
import { latticeVolumes, type CityLattice, type LatticePoint } from '../../domain/city-volume';

function topJoints(
	faces: readonly (readonly string[])[],
	nodes: ReadonlyMap<string, LatticePoint>
) {
	const ids = [...new Set(faces.flat())];
	const z = (id: string) => required(nodes.get(id), 'solid joint').position[2];
	const highest = Math.max(...ids.map(z));
	return ids.filter((id) => z(id) === highest);
}

/** Distributes each solid's nominal gravity equally among its highest joints. */
export function tributaryForces(lattice: CityLattice, nodes: ReadonlyMap<string, LatticePoint>) {
	const volumes = latticeVolumes(lattice);
	const totals = new Map<string, number>();
	for (const [i, { faces }] of lattice.solids.entries()) {
		const joints = topJoints(faces, nodes);
		const share = (Math.max(0, volumes[i]) * defaults.tributaryWeightKNM3) / joints.length;
		for (const id of joints) totals.set(id, (totals.get(id) ?? 0) + share);
	}
	return [...totals].map(([joint, forceKN]) => Object.freeze({ joint, forceKN }));
}
