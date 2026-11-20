import { buildObject, type ObjectOptions } from '../assets';
import type { Primitive } from '../parametrik/types';

import type { Occupant, StructuralRole } from '../house-typology';

export type HousePart = StockPart & ({ structuralRole: StructuralRole } | Occupant);
export type StockPart = Primitive & {
	source: { objectId: string; variant: string; seed: number; slot: string; member: number };
};

/** Keeps the registry member address beside its projected geometry, independently of the house's picking ID. */
export function houseObject(
	objectId: string,
	variant: string,
	seed: number,
	options: Required<ObjectOptions>
) {
	const object = buildObject(objectId, variant, seed, options);
	const parts: StockPart[] = object.parts.map((p, member) => ({
		...p,
		source: { objectId, variant, seed, slot: object.geometry[member].slot, member }
	}));
	return { parts, anchors: object.anchors, footprint: object.footprint };
}
