/** Module: Builds procedural surface families on metric patches. */

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

/** Builds a sample plate on a metric patch with its cladding paint groups. */
export { createSamplePlateObject, samplePlateParams, samplePlateBackingM } from './plate';
