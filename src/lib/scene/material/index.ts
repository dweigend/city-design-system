/** Module: Defines the shared shade and pencil appearance of material objects. */
import { defaults } from '../../../config/material-drawing';

/** Material geometry and its paint metadata consumed by scene projections. */
export {
	buildSurface,
	createClad,
	createSamplePlateObject,
	familyNames,
	readFamily,
	readPatchArea,
	surfaceLevels,
	type CladInput,
	type CladObject,
	type Cladding,
	type Family,
	type FamilySlot,
	type Patch,
	type Rect,
	type SurfaceLevel,
	type SurfaceMesh,
	type SurfaceOptions
} from '../../domain/material';

/** Oklab lightness offset of cast shade from every face it falls on (MAT-2). */
export const castShade = defaults.shadeLightness;

/** Hatch strength and joint-line width (CSS px) and opacity of the pencil level. */
export const pencilStroke = Object.freeze({
	hatch: defaults.pencilHatchRatio,
	width: defaults.pencilStrokeWidthPx,
	opacity: defaults.pencilStrokeOpacityRatio
});
