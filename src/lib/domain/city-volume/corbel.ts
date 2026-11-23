import type { PlaneRule } from './plane-joints';
import { taper } from './taper';

/** Corners cantilever over the lower columns by a fixed run per level above the lowest
 * neighbor, so every edge of the height profile widens upward. */
export const corbel: PlaneRule = { plane: () => 'plan', shift: taper(-1) };
