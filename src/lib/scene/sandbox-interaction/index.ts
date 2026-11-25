/** Module: Holds sandbox interaction state: stroke preview, build queue and detail per house. */

/** A time-budgeted, cancellable build queue with a small product cache per owner. */
export {
	/** Creates a time-budgeted build queue. */
	createBuildQueue,
	/** Shortest time in milliseconds between two showings of built products while the queue is busy. */
	showIntervalMs,
	/** A pure build with a stable owner ID and a key for its exact inputs. */
	type BuildJob
} from './queue';
/** The preview state machine of one painting pointer. */
export {
	/** Stages ordered edits and visible overrides without touching the committed document or build queue. */
	createStrokeDraft,
	/** Creates the preview state machine of one painting pointer. */
	createStrokeState,
	/** Caller action after pointer input, from hover through stroke commit or cancellation. */
	type StrokeEffect,
	/** One pointer input already resolved to the hosts it crossed since the previous input. */
	type StrokeInput
} from './stroke';
/** The thin level-of-detail policy and the block budget share. */
export {
	/** Returns the preview mass height in meters, approximately at the house eaves. */
	readPreviewHeight,
	/** Reads shared house salience for a sandbox view. */
	selectHouseDetail,
	/** Divides a block's triangle budget evenly among its placed houses. */
	shareBlockBudget,
	/** One candidate with the sandbox's current selection and pointer state. */
	type DetailSubject
} from './detail';
