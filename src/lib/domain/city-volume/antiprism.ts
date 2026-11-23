import type { PlaneRule } from './plane-joints';

/** Level planes alternate between the plan and its dual: odd planes hold one joint over each
 * cell centre. Pyramids, edge tetrahedra and corner pyramids fill every layer (octet stacking). */
export const antiprism: PlaneRule = {
	plane: (level, aboveBase) => (aboveBase > 0 && level % 2 ? 'centre' : 'plan')
};
