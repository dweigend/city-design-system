/** Module: Defines the frozen valley measurement protocol and reference bands. */
import { defaults } from '../../../config/valley-measurement';
import { VALLEY_EXPECTED_BORDER_HITS } from './reference.evidence';

const {
	measurementLocalWindowM,
	measurementRegionalWindowM,
	measurementCourseSpacingM,
	measurementCornerBearingsDeg,
	measurementReliefCoreM,
	measurementFieldSpacingM,
	measurementStationOffsetM,
	measurementStationTangentHalfLengthM,
	measurementBoxFractions,
	measurementGaussianTruncateSigma,
	measurementLandSlopeClassLimits,
	measurementSurfaceSpacingM,
	measurementSmoothingSigmaM,
	measurementProfileSpacingM,
	measurementProfileHalfLengthM,
	measurementStepMinimumSlope,
	measurementStepMinimumGainM,
	measurementGentleSlopeLimit
} = defaults;

/** Centered vector and surface measurement settings. Slopes are rise/run. */
export const VALLEY_MEASUREMENT_PROTOCOL = {
	localWindowM: measurementLocalWindowM,
	regionalWindowM: measurementRegionalWindowM,
	courseSpacingM: measurementCourseSpacingM,
	borderHits: VALLEY_EXPECTED_BORDER_HITS,
	cornerBearingsDeg: [...measurementCornerBearingsDeg],
	reliefCoreM: measurementReliefCoreM,
	fieldSpacingM: measurementFieldSpacingM,
	bankSampling: 'linear-bed-minus-water-zero-crossing',
	stationOffsetM: measurementStationOffsetM,
	stationTangentHalfLengthM: measurementStationTangentHalfLengthM,
	boxFractions: [...measurementBoxFractions],
	gaussianTruncateSigma: measurementGaussianTruncateSigma,
	landSlopeClassLimits: [...measurementLandSlopeClassLimits],
	surfaceSpacingM: measurementSurfaceSpacingM,
	smoothingSigmaM: measurementSmoothingSigmaM,
	profileSpacingM: measurementProfileSpacingM,
	profileHalfLengthM: measurementProfileHalfLengthM,
	stepMinimumSlope: measurementStepMinimumSlope,
	stepMinimumGainM: measurementStepMinimumGainM,
	gentleSlopeLimit: measurementGentleSlopeLimit
} as const;

export {
	/** Inclusive bands for the course, field wet width and bare-earth measurements. */
	LARGE_LOWLAND_MEASUREMENT_BANDS,
	/** Form gates for the corrected valley family. */
	VALLEY_FORM_BANDS,
	/** ASCII K11a as a u32. */
	VALLEY_HOLDOUT_ROOT,
	/** Frozen seed set reserved for independent valley measurement. */
	VALLEY_HOLDOUT_SEEDS,
	/** The picture plates face downstream at a shared bearing. */
	VALLEY_PICTURE_BEARING_RAD,
	/** Fixed valley seeds used for the canonical reference pictures. */
	VALLEY_PICTURE_SEEDS,
	/** River geometry and bare-earth measurements from the reference comparison table. */
	VALLEY_REFERENCES,
	/** Geometric differences measured at the seven interior rows of the shared picture frame. */
	VALLEY_WINDOW_FORM,
	/** Fixed valley seeds for the X1 measurement matrix. */
	VALLEY_X1_SEEDS
} from './reference.evidence';
