import { defaults } from '../../../config/house-projection';
import { readDisplayPresentation, type DisplayLevel } from '../focus';
import { blockSurfaces, fullSurfaces, pencilSurfaces, veilSurfaces } from './surfaces';

const { pencilHatch, veilAlpha } = defaults;

const noHatch = /* Exact arithmetic: zero hatch coverage. */ 0;
const opaque = /* Exact arithmetic: full fill opacity. */ 1;
const noFill = /* Exact arithmetic: zero fill opacity. */ 0;
const houseTreatments = {
	solid: { hatch: noHatch, fillAlpha: opaque },
	ghost: { surfaces: veilSurfaces, hatch: noHatch, fillAlpha: veilAlpha },
	pencil: { surfaces: pencilSurfaces, hatch: pencilHatch, fillAlpha: opaque },
	wire: { surfaces: undefined, hatch: noHatch, fillAlpha: noFill }
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
