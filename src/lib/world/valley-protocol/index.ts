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
	LARGE_LOWLAND_MEASUREMENT_BANDS,
	VALLEY_FORM_BANDS,
	VALLEY_HOLDOUT_ROOT,
	VALLEY_HOLDOUT_SEEDS,
	VALLEY_PICTURE_BEARING_RAD,
	VALLEY_PICTURE_SEEDS,
	VALLEY_REFERENCES,
	VALLEY_WINDOW_FORM,
	VALLEY_X1_SEEDS
} from './reference.evidence';
