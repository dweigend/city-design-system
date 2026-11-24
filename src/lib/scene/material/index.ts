import { materialSettings } from '../../../config/material';
import type { Vec3 } from '../../core/geometry';
import type { DisplayLevel } from '../focus';
import type { SurfaceLevel } from './build';

/** An axis-aligned opening or region in patch meters, and a planar patch to clad. */
export type { Patch, Rect } from './patch';
/** Procedural surface families as data, their role slots and the family table reader. */
export { familyNames, readFamily, type Family, type FamilySlot } from './families';
/** Builds one family on one patch at a drawing level within a triangle budget. */
export { buildSurface, surfaceLevels, type SurfaceLevel, type SurfaceMesh, type SurfaceOptions } from './build';
/** Merges claddings into one object with `role/slot` slots; sample plates and the sample body. */
export { createClad, createSampleBoard, createSampleBody, type CladObject, type Cladding } from './specimen';

/** Triangle budgets of one sample plate and one sample body. */
export const triangleBudgets = Object.freeze({
	plate: materialSettings.plateTriangleBudget,
	body: materialSettings.bodyTriangleBudget
});

/** Lowest, highest and step of the player's module scale, relief scale and seed. */
export const surfaceControls = Object.freeze({
	moduleScale: materialSettings.moduleScaleBand,
	reliefScale: materialSettings.reliefScaleBand,
	seed: materialSettings.seedBand
});

/** Oklab lightness offset of cast shade from every face it falls on (MAT-2). */
export const castShade = materialSettings.shadeLightness;

/** Hatch strength and joint-line width (CSS px) and opacity of the pencil level. */
export const pencilStroke = Object.freeze({
	hatch: materialSettings.pencilHatchRatio,
	width: materialSettings.pencilStrokeWidthPx,
	opacity: materialSettings.pencilStrokeOpacityRatio
});

/** The direction light travels for a horizontal shadow direction and a reach in meters of shadow
 * per meter of height, as the stage casts its ground shade. */
export function readLight(direction: readonly [number, number], reach: number): Vec3 {
	return [direction[0] * reach, direction[1] * reach, -1];
}

const detail = {
	full: 'relief',
	silhouette: 'flat',
	transparent: 'flat',
	pencil: 'pencil',
	hidden: undefined
} as const satisfies Record<DisplayLevel, SurfaceLevel | undefined>;

/** The surface detail for a focus display level (COLOR-6): full keeps the relief, silhouette and
 * transparent draw a flat slab, pencil draws the joints as lines, hidden draws nothing. */
export function readSurfaceLevel(level: DisplayLevel): SurfaceLevel | undefined {
	if (!Object.hasOwn(detail, level)) throw new RangeError(`Unknown display level "${level}"`);
	return detail[level];
}
