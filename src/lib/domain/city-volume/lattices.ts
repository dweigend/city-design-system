import { createCatalog } from '../../core/catalog';
import type { Column } from './bay-addresses';
import type { Vec3 } from '../../core/geometry';
import { antiprism } from './antiprism';
import { diagrid } from './diagrid';
import { createFrame, prismVariants, type CityLattice, type PrismVariant } from './frame';
import { createPlaneLattice } from './plane-lattice';
import type { PlaneRule } from './plane-joints';
import { solidVolume } from './solid';
import { tree } from './tree';

type Build = (columns: readonly Column[], datumZ: number) => CityLattice;

const prisms =
	(variant: PrismVariant): Build =>
	(columns, datumZ) =>
		createFrame(columns, datumZ, variant);
const planes =
	(rule: PlaneRule): Build =>
	(columns, datumZ) =>
		createPlaneLattice(columns, datumZ, rule);

/** Every lattice model in display order, prisms first. */
const builders = createCatalog({
	rows: [
		...prismVariants.map((id) => ({ id, build: prisms(id) })),
		{ id: 'antiprism', build: planes(antiprism) },
		{ id: 'diagrid', build: planes(diagrid) },
		{ id: 'tree', build: planes(tree) }
	] as const
});

export type LatticeVariant = (typeof builders.ids)[number];
export const latticeVariants = builders.ids;

export function createLattice(columns: readonly Column[], datumZ: number, variant: LatticeVariant) {
	return builders.get(variant).build(columns, datumZ);
}

/** Signed volume in m³ of every solid of a lattice, in solid order. */
export function latticeVolumes(lattice: CityLattice) {
	const positions = new Map<string, Vec3>(lattice.nodes.map(({ id, position }) => [id, position]));
	const position = (id: string) => {
		const found = positions.get(id);
		if (!found) throw new RangeError(`Unknown lattice joint ${id}`);
		return found;
	};
	return lattice.solids.map((solid) => solidVolume(solid, position));
}
