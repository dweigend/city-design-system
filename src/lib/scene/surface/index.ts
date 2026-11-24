/** Module: Assigns finishes and color tokens to placeable geometry. */
/** Surface finishes, the colour token and finish of a slot, drawable parts and their inputs. */
export type { Drawable, Finish, Surface, SurfaceAssignment, TerrainField, Warp } from './surfaces';
/** Stock, landscape, district, study, plan and stock-drawing assignments. */
export {
	districtSurfaces,
	existing,
	landscape,
	planOverlaySurfaces,
	planningStudy,
	stockSurfaces
} from './surfaces';
/** The default city height scale in meters and a ramp with a caller-selectable upper elevation. */
export { cityHeightScaleM, heightRamp } from './surfaces';
/** Accents a wall, resolves an object's slots to drawables and validates colour tokens. */
export { accent, resolveSurfaces, validateTokens } from './surfaces';
/** The model palette by family, slot, tone and display, and the assignment boundary of clad
 * objects and of plain bodies in a model material. */
export {
	modelTones,
	paintClad,
	readMaterialSurface,
	readModelSurface,
	type MaterialDisplay,
	type ModelMaterial,
	type ModelTone
} from './palette';
