import { materialSettings } from '../../../config/material';

/** An axis-aligned opening or region in patch meters, and a planar patch to clad. */
export { readPatchArea, type Patch, type Rect } from './patch';
/** Procedural surface families as data, their role slots and the family table reader. */
export { familyNames, readFamily, type Family, type FamilySlot } from './families';
/** Builds one family on one patch at a drawing level within a triangle budget. */
export {
	buildSurface,
	fitModuleScale,
	surfaceLevels,
	type SurfaceLevel,
	type SurfaceMesh,
	type SurfaceOptions
} from './build';
/** Combines compatible claddings and plain parts in one placeable object. */
export { createClad, type CladInput, type CladObject, type Cladding } from './clad';

/** Oklab lightness offset of cast shade from every face it falls on (MAT-2). */
export const castShade = materialSettings.shadeLightness;

/** Hatch strength and joint-line width (CSS px) and opacity of the pencil level. */
export const pencilStroke = Object.freeze({
	hatch: materialSettings.pencilHatchRatio,
	width: materialSettings.pencilStrokeWidthPx,
	opacity: materialSettings.pencilStrokeOpacityRatio
});
