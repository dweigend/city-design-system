/** Module: Defines the shared grain and pencil appearance of model material objects. */
import { defaults } from '../../../config/material-drawing';

/** Material geometry and its paint metadata consumed by scene projections. */
export {
	buildSurface,
	createClad,
	createPatternFrame,
	createSamplePlateObject,
	familyNames,
	fitModuleScale,
	lowerLevel,
	printsMarks,
	readFamily,
	readLevelDetail,
	readPatchArea,
	readSurfaceLevelName,
	surfaceLevels,
	type CladInput,
	type CladObject,
	type Cladding,
	type Family,
	type FamilySlot,
	type Patch,
	type PatternFrame,
	type Rect,
	type SurfaceLevel,
	type SurfaceLevelAlias,
	type SurfaceMesh,
	type SurfaceOptions
} from '../../domain/material';

/** Fine even grain of cork and of card (MAT-8): lightness swing (Oklab L) and speck size (m). */
export const modelGrain = Object.freeze({
	cork: Object.freeze({ amount: defaults.corkGrainLightness, cellM: defaults.grainCellM }),
	card: Object.freeze({ amount: defaults.cardGrainLightness, cellM: defaults.grainCellM })
});

/** Least Oklab distance of a model tone from every flow colour (MAT-11). */
export const functionColourDistance = defaults.functionColourDistance;

/** Hatch strength and joint-line width (CSS px) and opacity of the pencil level. */
export const pencilStroke = Object.freeze({
	hatch: defaults.pencilHatchRatio,
	width: defaults.pencilStrokeWidthPx,
	opacity: defaults.pencilStrokeOpacityRatio
});
