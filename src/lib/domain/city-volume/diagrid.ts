import type { PlaneRule } from './plane-joints';

/** Level planes alternate between the plan and its medial plan: odd planes hold one joint over
 * each edge midpoint. Diagonals cross every facade without a vertical; cut-corner frustums and
 * corner pyramids fill every layer. */
export const diagrid: PlaneRule = {
	plane: (level, aboveBase) => (aboveBase > 0 && level % 2 ? 'medial' : 'plan')
};
