import { defaults } from '../../../config/house-projection';
import type { DisplayLevel } from '../focus';
import { blockSurfaces, fullSurfaces, pencilSurfaces, veilSurfaces } from './surfaces';

const { pencilHatch, veilAlpha } = defaults;

/** The drawing of a house at each display level of COLOR-6: which object detail it reads and how
 * the slots look. `hidden` draws nothing. */
export const houseLevels = Object.freeze({
	full: /* Exact arithmetic: full display is opaque and has no hatch. */ {
		detail: 'full',
		surfaces: fullSurfaces,
		hatch: 0,
		fillAlpha: 1
	},
	silhouette: /* Exact arithmetic: silhouette is opaque and has no hatch. */ {
		detail: 'block',
		surfaces: blockSurfaces,
		hatch: 0,
		fillAlpha: 1
	},
	transparent: /* Exact arithmetic: transparent display has no hatch. */ {
		detail: 'block',
		surfaces: veilSurfaces,
		hatch: 0,
		fillAlpha: veilAlpha
	},
	pencil: /* Exact arithmetic: pencil face is opaque. */ {
		detail: 'block',
		surfaces: pencilSurfaces,
		hatch: pencilHatch,
		fillAlpha: 1
	},
	hidden: /* Exact arithmetic: hidden display has no fill or hatch. */ {
		detail: 'block',
		surfaces: undefined,
		hatch: 0,
		fillAlpha: 0
	}
} as const satisfies Record<DisplayLevel, unknown>);
