import type { PlaneRule } from './plane-lattice';

/** Every column stands on one foot at its cell centre, branches to its edge midpoints on the
 * first plane and to its corners on the second; above that it rises as a box. */
export const tree: PlaneRule = {
	plane: (level) => (level === 0 ? 'foot' : level === 1 ? 'medial' : 'plan')
};
