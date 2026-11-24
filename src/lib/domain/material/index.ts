/** Module: Builds model-making materials on metric patches. */

/** An axis-aligned opening or region in patch meters, a planar patch and a body's pattern box. */
export { readPatchArea, type PatternFrame, type Patch, type Rect } from './patch';
/** The pattern box shared by the faces of one body. */
export { createPatternFrame } from './pattern';
/** Model material families as data, their role slots and the family table reader. */
export {
	familyNames,
	readFamily,
	type Family,
	type FamilySlot,
	type PatternKind
} from './families';
/** Surface levels by distance, their aliases and what each draws. */
export {
	lowerLevel,
	readLevelDetail,
	readSurfaceLevelName,
	surfaceLevels,
	type SurfaceLevel,
	type SurfaceLevelAlias
} from './levels';
/** Builds one family on one patch at a level within a triangle budget. */
export { buildSurface, fitModuleScale, type SurfaceMesh, type SurfaceOptions } from './build';
/** Combines compatible claddings and plain parts in one placeable object. */
export { createClad, type CladInput, type CladObject, type Cladding } from './clad';

/** Builds a sample plate on a metric patch with its cladding paint groups. */
export { createSamplePlateObject, samplePlateParams, samplePlateBackingM } from './plate';
