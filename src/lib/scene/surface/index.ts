/** Module: Assigns finishes and color tokens to placeable geometry. */
/** Surface finishes, the colour token and finish of a slot, drawable parts and their inputs. */
export type {
	/** One part’s id, geometry and surface. */
	Drawable,
	/** Surface treatment including pencil outlines and non-stacking ground shade. */
	Finish,
	/** One CSS color token and finish for a slot. */
	Surface,
	/** Explicit lookup of surfaces by slot name. */
	SurfaceAssignment,
	/** South-first terrain samples. */
	TerrainField,
	/** Horizontal offsets in local meters, x and y per fill vertex and per explicit stroke endpoint. */
	Warp
} from './surfaces';
/** Stock, landscape, district, study, plan and stock-drawing assignments. */
export {
	/** Blueprint tones by district density, plus the ground shade surface. */
	districtSurfaces,
	/** The house's neutral stock assignment, with one explicit finish per slot. */
	existing,
	/** Paper ground and the pale step of the existing water color. */
	landscape,
	/** Surface assignments by overlay slot for the plan, water cells, crossings, and public ground. */
	planOverlaySurfaces,
	/** Fine pencil lines and small joints for the coarse carrier. */
	planningStudy,
	/** Pale veil and pencil paper treatments for stock outside focus. */
	stockSurfaces
} from './surfaces';
/** The default city height scale in meters and a ramp with a caller-selectable upper elevation. */
export {
	/** Default upper tick of the column height ramp in true meters. */
	cityHeightScaleM,
	/** Sequential palette from zero to a finite positive upper elevation in meters. */
	heightRamp
} from './surfaces';
/** Accents a wall, resolves an object's slots to drawables and validates colour tokens. */
export {
	/** Returns the stock assignment with one flow color on the wall. */
	accent,
	/** Resolves a fresh list in part order, retaining frozen shape references and leaving inputs untouched. */
	resolveSurfaces,
	/** Checks assigned colors against the supplied token names without modifying either input. */
	validateTokens
} from './surfaces';
/** The model palette by family, slot, tone and display, and the assignment boundary of clad
 * objects and of plain bodies in a model material. */
export {
	/** Warm neutrals, saturated matte colors, accents, and flat roof tone (MAT-11). */
	modelTones,
	/** Paints compatible cladding groups by family, tone, level and slot. */
	paintClad,
	/** Paints the grove's three role slots as quiet matte model materials. */
	projectGrove,
	/** Resolves a family slot surface and applies the selected tone for tinted families. */
	readMaterialSurface,
	/** Reads a flat matte body surface with optional grain in the family tone (MAT-7). */
	readModelSurface,
	/** Authored material colors or translucent gray bodies (COLOR-8). */
	type MaterialDisplay,
	/** Registered material family and optional tone for tinted families. */
	type ModelMaterial,
	/** One tone of the model palette. */
	type ModelTone
} from './palette';
