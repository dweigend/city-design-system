import type { Vec3 } from '../../core/geometry';
import { antiprism } from './antiprism';
import { corbel } from './corbel';
import { diagrid } from './diagrid';
import {
	createFrame,
	prismVariants,
	type CityLattice,
	type Column,
	type PrismVariant
} from './frame';
import { createPlaneLattice, type PlaneRule } from './plane-lattice';
import { setback } from './setback';
import { solidVolume } from './solid';
import { tree } from './tree';

type Build = (columns: readonly Column[], datumZ: number, height: number) => CityLattice;

const prisms =
	(variant: PrismVariant): Build =>
	(columns, datumZ, height) =>
		createFrame(columns, datumZ, height, variant);
const planes =
	(rule: PlaneRule): Build =>
	(columns, datumZ, height) =>
		createPlaneLattice(columns, datumZ, height, rule);

/** The one dispatch table: every lattice model by name, prisms first. */
const builders = {
	...(Object.fromEntries(prismVariants.map((variant) => [variant, prisms(variant)])) as Record<
		PrismVariant,
		Build
	>),
	antiprism: planes(antiprism),
	diagrid: planes(diagrid),
	tree: planes(tree),
	setback: planes(setback),
	corbel: planes(corbel)
};

export type LatticeVariant = keyof typeof builders;
export const latticeVariants = Object.freeze(Object.keys(builders) as LatticeVariant[]);

export function createLattice(
	columns: readonly Column[],
	datumZ: number,
	height: number,
	variant: LatticeVariant
) {
	return builders[variant](columns, datumZ, height);
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
