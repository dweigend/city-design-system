import { defaults } from '../../../config/house-projection';
import { readDisplayPresentation, type DisplayLevel } from '../focus';
import { blockSurfaces, fullSurfaces, pencilSurfaces, veilSurfaces } from './surfaces';

const { pencilHatch, veilAlpha } = defaults;

const houseTreatments = /* Exact arithmetic: opaque and omitted fills, and no-hatch switches. */ {
	solid: { hatch: 0, fillAlpha: 1 },
	ghost: { surfaces: veilSurfaces, hatch: 0, fillAlpha: veilAlpha },
	pencil: { surfaces: pencilSurfaces, hatch: pencilHatch, fillAlpha: 1 },
	wire: { surfaces: undefined, hatch: 0, fillAlpha: 0 }
} as const;

const solidDetails = {
	full: { detail: 'full', surfaces: fullSurfaces },
	plain: { detail: 'block', surfaces: blockSurfaces }
} as const;

/** The drawing of a house at each display level of COLOR-6: which object detail it reads and how
 * the slots look. `hidden` draws nothing. */
export const houseLevels = Object.freeze({
	full: {
		...solidDetails[readDisplayPresentation('full').detail],
		...houseTreatments[readDisplayPresentation('full').treatment]
	},
	silhouette: {
		...solidDetails[readDisplayPresentation('silhouette').detail],
		...houseTreatments[readDisplayPresentation('silhouette').treatment]
	},
	transparent: {
		detail: 'block',
		...houseTreatments[readDisplayPresentation('transparent').treatment]
	},
	pencil: { detail: 'block', ...houseTreatments[readDisplayPresentation('pencil').treatment] },
	hidden: { detail: 'block', ...houseTreatments[readDisplayPresentation('hidden').treatment] }
} as const satisfies Record<DisplayLevel, unknown>);
