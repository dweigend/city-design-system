/** Module: Spans facade bands and tensioned membranes between surveyed grips in meters. */

export {
	/** Spans ordered frontage bays at each course, with open reveals and a cuff at each end. */
	createFacadeBands,
	/** Surveyed frontage grips and course dimensions in meters. */
	type FacadeBandsSpec
} from './bands';

export {
	/** Triangulates a fabric patch with ordered, outward-facing triangles and perimeter cuffs. */
	createTensionPatch,
	/** Cyclic corner grips, optional edge grips and normalized membrane settings. */
	type TensionPatchSpec
} from './patch';

export type {
	/** A surveyed attachment address and its XYZ position in meters. */
	EnvelopeGrip
} from './grips';
