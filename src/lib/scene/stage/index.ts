/** Module: Renders drawables with WebGPU in shared camera views. */
import { createStage, type StageOptions } from './lifecycle';
import { openRenderer } from './renderer';

/** Camera projections for the same geometry. */
export type {
	/** A world-space camera origin and unit direction into the scene. */
	CameraRay,
	/** Named camera projections of the same stage geometry. */
	View,
	/** Optional orthographic fit with radian angles, a fill fraction, and positive relative zoom. */
	ViewFit
} from './camera';
export {
	/** Unit direction of cast shadows in world XY. */
	shadowDirection,
	/** Horizontal shadow distance in meters per meter of object height. */
	shadowReach
} from './tone';
/** Direction of the stage light for surface recipes. */
export { surfaceLight } from './tone';
/** Measures a subject in the plane of a fitted view. */
export { projectFocus } from './camera';
/** Connects pointer and keyboard navigation to camera framing. */
export {
	/** Pointer and keyboard navigation. */
	stageNavigation,
	/** Positive, finite relative zoom bounds, inclusive. */
	type ZoomLimits
} from './navigation';
/** Triangulates a box, prism or mesh shape into flat positions and triangle indices. */
export { shapeArrays } from './geometry';
/** Horizontal framing in world meters and CSS pixels, independent of device pixel ratio. */
export type {
	/** The fitted camera width and scale, and the point the camera looks at in stage meters. */
	Viewport,
	/** Calculates presentation properties over existing drawable geometry for a fitted viewport. */
	Presentation
} from './lifecycle';

/** Surface displays for the same geometry. */
export type { Display } from './material';
/** Returns the fixed house, resolved surfaces and metric extents for a stage. */
export { stageExample } from './stage-example';

function create(options: StageOptions) {
	return createStage(options, openRenderer);
}

/** Opens a WebGPU stage on the supplied canvas. Rejects if WebGPU cannot initialise. */
export const Stage = Object.freeze({ create });
