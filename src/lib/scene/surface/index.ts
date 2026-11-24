/** Surface finishes, the colour token and finish of a slot, drawable parts and their inputs. */
export type { Drawable, Finish, Surface, SurfaceAssignment, TerrainField, Warp } from './surfaces';
/** Stock, landscape, district, study, plan and stock-drawing assignments, and the height ramp. */
export {
	cityHeightScaleM,
	districtSurfaces,
	existing,
	heightRamp,
	landscape,
	planOverlaySurfaces,
	planningStudy,
	stockSurfaces
} from './surfaces';
/** Accents a wall, resolves an object's slots to drawables and validates colour tokens. */
export { accent, resolveSurfaces, validateTokens } from './surfaces';
/** The material palette by family, slot and display, and the assignment boundary of clad objects. */
export { paintClad, readMaterialSurface, type MaterialDisplay } from './palette';
