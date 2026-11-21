/** River geometry and bare-earth measurements from the reference comparison table. */
export const VALLEY_REFERENCES = [
	{
		city: 'Cologne',
		surface: 'dtm',
		elevationProduct: 'DGM1 NRW',
		osmDataDate: '2026-05-31',
		wetWidthMedianM: 369,
		wetWidthP10P90M: [324, 391],
		sinuosity2km: 1.014,
		sinuosity8km: 1.155,
		smoothedCoreReliefM: 16.6,
		landSlopeBelow2PercentShare: 0.691,
		stepHeightP10P50P90M: [3.5, 5.7, 8.0]
	},
	{
		city: 'Bonn',
		surface: 'dsm',
		elevationProduct: 'Copernicus GLO-30',
		osmDataDate: '2026-07-28',
		wetWidthMedianM: 381,
		wetWidthP10P90M: [350, 404],
		sinuosity2km: 1.008,
		sinuosity8km: 1.072
	},
	{
		city: 'Basel',
		surface: 'dsm',
		elevationProduct: 'Copernicus GLO-30',
		osmDataVersion: '118428',
		wetWidthMedianM: 188,
		wetWidthP10P90M: [175, 208],
		sinuosity2km: 1.105,
		sinuosity8km: 1.296
	},
	{
		city: 'Regensburg',
		surface: 'dsm',
		elevationProduct: 'Copernicus GLO-30',
		osmDataDate: '2026-11-07',
		wetWidthMedianM: 88,
		wetWidthP10P90M: [75, 104],
		sinuosity2km: 1.003,
		sinuosity8km: 1.099
	}
] as const;

/** Centered vector and surface measurement settings. Slopes are rise/run. */
export const VALLEY_MEASUREMENT_PROTOCOL = {
	localWindowM: 2_000,
	regionalWindowM: 8_000,
	courseSpacingM: 6.25,
	borderHits: 2,
	cornerBearingsDeg: [0, 15, 30, 45, 60, 75, 90],
	reliefCoreM: 1_000,
	fieldSpacingM: 12.5,
	bankSampling: 'linear-bed-minus-water-zero-crossing',
	stationOffsetM: 125,
	stationTangentHalfLengthM: 60,
	boxFractions: [0, 0.5, 1],
	gaussianTruncateSigma: 4,
	landSlopeClassLimits: [0.02, 0.05, 0.15],
	surfaceSpacingM: 30,
	smoothingSigmaM: 30,
	profileSpacingM: 250,
	profileHalfLengthM: 1_000,
	stepMinimumSlope: 0.05,
	stepMinimumGainM: 3,
	gentleSlopeLimit: 0.02
} as const;

/** Inclusive bands for the course, field wet width and bare-earth measurements. */
export const LARGE_LOWLAND_MEASUREMENT_BANDS = {
	sinuosity2km: [1, 1.11],
	sinuosity8km: [1.05, 1.3],
	medianSinuosity8km: [1.12, 1.19],
	medianSinuosity2kmTarget: 1.05,
	wetWidthM: [320, 420],
	smoothedCoreReliefM: [12, 22],
	gentleLandShare: [0.6, 0.8],
	minimumStepCandidates: 1,
	medianStepHeightM: [3, 8],
	maximumStepHeightP90M: 10
} as const;

/** Form gates for the corrected valley family. Ratios use the complete dry bank pairs. */
export const VALLEY_FORM_BANDS = {
	minimumStepSpreadM: 2.25,
	minimumFloodplainWidthRatio: 2,
	minimumCompleteBankPairs: 2,
	minimumWetMaskDifference: 0.1,
	minimumFloodplainMaskDifference: 0.2
} as const;

export const VALLEY_PICTURE_SEEDS = [1201, 1301, 1409] as const;
export const VALLEY_X1_SEEDS = [...VALLEY_PICTURE_SEEDS, 1511, 1601, 1709] as const;

/** ASCII K11a as a u32. The first holdout is nextSeed(root). */
export const VALLEY_HOLDOUT_ROOT = 0x4b313161;

export const VALLEY_HOLDOUT_SEEDS = [
	3155850407, 3032341919, 2799001226, 1036131210, 1709665949, 3466739293, 677990376, 2844915100,
	1894672125, 1048223828, 4251716292, 2229326215, 4269269943, 456317780, 460221850, 3509438072,
	3239712218, 2835304664, 732095234, 1163590840, 1488913703, 1024177156, 3437242574, 2480506285,
	2359607947, 2254824057, 1107053302, 2134785486, 3353080857, 3979671109, 4138160453, 1873151536
] as const;
