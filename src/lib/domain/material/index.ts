/** Module: Builds model-making materials on metric patches. */

/** An axis-aligned opening or region in patch meters, a planar patch and a body's pattern box. */
export {
	/** Area of the outline minus the union of its clipped openings, in square meters. */
	readPatchArea,
	/** Origin, unit axes, and extents in meters of the common pattern box for one body (MAT-9). */
	type PatternFrame,
	/** Planar surface in meters with unit across and normal axes. */
	type Patch
} from './patch';
/** Axis-aligned bounds in patch meters ordered left, bottom, right, and top. */
export type { Rect } from './cells';
/** The pattern box shared by the faces of one body. */
export { createPatternFrame } from './pattern';
/** Model material families as data, their role slots and the family table reader. */
export {
	/** Families in table order. */
	familyNames,
	/** Reads a family's pattern, slots and default parameters. */
	readFamily,
	/** A model material family. */
	type Family,
	/** Caller-supplied pattern or parameter overrides for one build. */
	type FamilyRecipe,
	/** Role of the face or printed marks emitted by a material family. */
	type FamilySlot,
	/** Plain tone, stripes that wrap the body, or dots in the plane of the face. */
	type PatternKind,
	/** Pattern pitch and joint spacing in meters, plus the fraction covered by marks. */
	type PatternParams
} from './families';
/** Surface levels by distance, their aliases and what each draws. */
export {
	/** Returns the less detailed canonical level, with pencil treated as the least detailed. */
	lowerLevel,
	/** Reads which marks, openings, joints, grain, and accents a level draws. */
	readLevelDetail,
	/** Resolves a level or an alias. */
	readSurfaceLevelName,
	/** Surface levels from most to least detail. */
	surfaceLevels,
	/** Surface drawing detail from plain through near, plus the separate pencil treatment (MAT-5, MAT-15). */
	type SurfaceLevel,
	/** Compatibility names that resolve relief to near and flat to plain. */
	type SurfaceLevelAlias
} from './levels';
/** Builds one family on one patch at a level within a triangle budget. */
export {
	/** Builds a material face, visible marks, and joint lines within the patch triangle budget. */
	buildSurface,
	/** Coarsens the requested pattern scale until the marks fit the patch triangle budget or step limit. */
	fitModuleScale,
	/** Tests whether the level draws the family's pattern marks at the requested scale. */
	hasPrintedMarks,
	/** Slot meshes and joint lines in world meters, with triangle count, level, and final pattern scale. */
	type SurfaceMesh,
	/** Surface drawing choices including a dimensionless pattern scale and an accepted seed (MAT-7). */
	type SurfaceOptions
} from './build';
/** Combines compatible claddings and plain parts in one placeable object. */
export {
	/** Builds claddings and merges parts that share a role, family, tone, drawn level and family slot. */
	createClad,
	/** Object identity, footprint, anchors and any plain parts with their declared slots. */
	type CladInput,
	/** A placeable object with paint groups for compatible meshes and results for each input patch. */
	type CladObject,
	/** A named patch and family with optional surface detail, module multiplier, and palette tone. */
	type Cladding
} from './clad';

/** Builds a sample plate on a metric patch with its cladding paint groups. */
export {
	/** Builds a clad plate and returns the placeable object with its scene paint groups. */
	createSamplePlateObject,
	/** Parameter schema for the two sides of a free plate. */
	samplePlateParams,
	/** Backing thickness for a free plate in meters. */
	samplePlateBackingM
} from './plate';
