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

/** The one dispatch table: every lattice model by name, prisms first. */
const builders = {
	...(Object.fromEntries(prismVariants.map((variant) => [variant, prisms(variant)])) as Record<
		PrismVariant,
		Build
	>),
	antiprism: planes(antiprism),
	diagrid: planes(diagrid),
	tree: planes(tree)
};

export type LatticeVariant = keyof typeof builders;
export const latticeVariants = Object.freeze(Object.keys(builders) as LatticeVariant[]);

export function createLattice(columns: readonly Column[], datumZ: number, variant: LatticeVariant) {
	return builders[variant](columns, datumZ);
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
