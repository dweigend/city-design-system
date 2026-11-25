/** Module: Draws structural graphs and gravity results. */
/** Projects metric members grouped by role, section and analysis band through the object and surface contracts. */
export { projectStructure } from './projection';
/** Overrideable support-pad and force-arrow dimensions. */
export type { MarkerSizing } from './markers';
/** Member display and analysis choices for the structural study. */
export {
	/** Structure focus shared by the study controls and member projection. */
	structureFocusPreset,
	/** Structural display choices for the same graph. */
	type StructureView
} from './focus';
/** Projects the standalone portal under its four roof loads. */
export { structureProjectionExample } from './structure-example';

/** Drawing values shared by the study controls and the projection. */
export { defaults as structureProjectionDefaults } from '../../../config/structure-projection';
