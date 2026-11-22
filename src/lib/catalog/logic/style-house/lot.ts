import type { BlockInputs } from '../../data/block-inputs';

/**
 * Shared site of every style house: a square lot of `width` metres centred on the origin
 * (x right, y to the back, z up), a top limit of `height` metres and a detail share.
 */
export type Lot = BlockInputs;

/** The leading share of an ordered detail list; complexity 0 keeps none, 1 keeps all. */
export function optional<T>(details: readonly T[], complexity: number): T[] {
	return details.slice(0, Math.round(complexity * details.length));
}
