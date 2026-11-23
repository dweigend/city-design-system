import type { PlaneRule } from './plane-lattice';
import { taper } from './taper';

/** Corners step back toward the taller columns by a fixed run per level above the lowest
 * neighbor, so every edge of the height profile tapers like a zoning setback. */
export const setback: PlaneRule = { plane: () => 'plan', shift: taper(1) };
