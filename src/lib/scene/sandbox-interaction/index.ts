/** Module: Holds sandbox interaction state: stroke preview, build queue and detail per house. */

/** A time-budgeted, cancellable build queue with a small product cache per owner. */
export { createBuildQueue, showIntervalMs, type BuildJob } from './queue';
/** The preview state machine of one painting pointer. */
export { createStrokeState, type StrokeEffect, type StrokeInput } from './stroke';
/** The thin level-of-detail policy and the block budget share. */
export {
	readPreviewHeight,
	selectHouseDetail,
	shareBlockBudget,
	type DetailSubject,
	type HouseDetail
} from './detail';
