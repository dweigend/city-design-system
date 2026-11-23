import type { PlaneRule } from './plane-joints';

/** Every column stands on one foot on the foundation cap at its cell centre, branches to its edge midpoints on the
 * next plane and to its corners on the following plane; above that it rises as a box. */
export const tree: PlaneRule = {
	plane: (_level, aboveBase) => (aboveBase === 0 ? 'foot' : aboveBase === 1 ? 'medial' : 'plan')
};
