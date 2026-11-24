import { defaults } from '../../../config/house-projection';
import type { DisplayLevel } from '../focus';
import { blockSurfaces, fullSurfaces, pencilSurfaces, veilSurfaces } from './surfaces';

const { pencilHatch, veilAlpha } = defaults;

/** The drawing of a house at each display level of COLOR-6: which object detail it reads and how
 * the slots look. `hidden` draws nothing. */
// Exact arithmetic: structural counts, origins and unit axes, not tunables.
export const houseLevels = Object.freeze({
	full: { detail: 'full', surfaces: fullSurfaces, hatch: 0, fillAlpha: 1 },
	silhouette: { detail: 'block', surfaces: blockSurfaces, hatch: 0, fillAlpha: 1 },
	transparent: { detail: 'block', surfaces: veilSurfaces, hatch: 0, fillAlpha: veilAlpha },
	pencil: { detail: 'block', surfaces: pencilSurfaces, hatch: pencilHatch, fillAlpha: 1 },
	hidden: { detail: 'block', surfaces: undefined, hatch: 0, fillAlpha: 0 }
} as const satisfies Record<DisplayLevel, unknown>);
