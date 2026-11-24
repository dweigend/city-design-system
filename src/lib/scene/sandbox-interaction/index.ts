/** Module: Interaction state of the sandbox: the stroke preview, the build queue and the level of
 * detail per house. It holds no document state; the page feeds it inputs and applies its effects. */

/** A time-budgeted, cancellable build queue with a small product cache per owner. */
export { createBuildQueue, type BuildJob } from './queue';
/** The preview state machine of one painting pointer. */
export { createStrokeState, type StrokeEffect, type StrokeInput } from './stroke';
/** The thin level-of-detail policy and the block budget share. */
export {
	selectHouseDetail,
	shareBlockBudget,
	type DetailSubject,
	type DetailView,
	type HouseDetail
} from './detail';
