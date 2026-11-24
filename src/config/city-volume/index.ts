import { defineSettings, joinSettings, settingValues } from '../setting';

function setting<const V extends number | readonly number[]>(
	value: V,
	unit: string,
	meaning: string
) {
	return { value, unit, meaning, rationale: 'Preserves the established calibration.' };
}

const base = defineSettings({
	startupAreaM2: {
		value: 10_800,
		unit: 'm²',
		meaning: 'Area a growth region must accumulate before its first published step',
		rationale: 'Preserves the minimum size of a new city region.'
	},
	maxRegions: {
		value: 8,
		unit: 'count',
		meaning: 'Maximum regions eligible to start growing',
		rationale: 'Preserves the city footprint limit on independent regions.'
	},
	mainPartAreaM2: {
		value: 1_000_000,
		unit: 'm²',
		meaning: 'Area above which a growth region carries no satellite entry cost',
		rationale: 'Preserves the ordering of existing city regions.'
	},
	satelliteEntryM: {
		value: 180,
		unit: 'm',
		meaning: 'Maximum additional entry cost for a small growth region',
		rationale: 'Preserves the ordering of existing city regions.'
	},
	crossingCostPerMeter: {
		value: 1.15,
		unit: 'ratio',
		meaning: 'Additional access cost per meter of crossing span',
		rationale: 'Preserves the ordering of existing river crossings.'
	},
	bayMemberWidthM: {
		value: 0.22,
		unit: 'm',
		meaning: 'Width of a square-profile member on a placeable lattice bay',
		principle: 'GRID-5'
	}
});

export const defaults = settingValues(base);

const cityVolume = defineSettings({
	storeysPerLevel: {
		value: 2,
		unit: 'storeys',
		meaning: 'Storeys on one coarse lattice level',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	maximumColumnLevels: {
		value: 15,
		unit: 'levels',
		meaning: 'Default construction limit above a structural column foundation',
		rationale: 'Keeps the established lattice limit independent of district height policy.'
	},
	maximumOccupiedBands: {
		value: 256,
		unit: 'count',
		meaning: 'Maximum foundation and above-ground bands in one column',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	townAreaKm2: {
		value: 1,
		unit: 'km²',
		meaning: 'Area at which block density appears',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	cityAreaKm2: {
		value: 3,
		unit: 'km²',
		meaning: 'Area at which center density appears',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	detachedLevels: {
		value: 1,
		unit: 'levels',
		meaning: 'Nominal height of detached stock',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	blockLevels: {
		value: 3,
		unit: 'levels',
		meaning: 'Nominal height of the block podium',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	maximumNeighborStepLevels: {
		value: 3,
		unit: 'levels',
		meaning: 'Maximum nominal height difference across a plan edge',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	firstPeakLevels: {
		value: 6,
		unit: 'levels',
		meaning: 'Nominal peak when the center first appears',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	fullPeakLevels: {
		value: 15,
		unit: 'levels',
		meaning: 'Maximum nominal peak of the settlement profile',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	fullPeakAreaKm2: {
		value: 8,
		unit: 'km²',
		meaning: 'Area at which the nominal peak reaches its cap',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	firstBlockShare: {
		value: 0.18,
		unit: 'ratio',
		meaning: 'Block share when the town first appears',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	blockSharePerKm2: {
		value: 0.09,
		unit: 'ratio/km²',
		meaning: 'Additional block share per square kilometre above the town threshold',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	maximumBlockShare: {
		value: 0.45,
		unit: 'ratio',
		meaning: 'Cap on the block share',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	firstCenterShare: {
		value: 0.05,
		unit: 'ratio',
		meaning: 'Center share when the city first appears',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	centerSharePerKm2: {
		value: 0.01,
		unit: 'ratio/km²',
		meaning: 'Additional center share per square kilometre above the city threshold',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	maximumCenterShare: {
		value: 0.1,
		unit: 'ratio',
		meaning: 'Cap on the center share',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	verticalChildCount: {
		value: 2,
		unit: 'count',
		meaning: 'Equal divisions of each bay band',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	corridorStepM: {
		value: 85,
		unit: 'm',
		meaning: 'Length of one proposed accessibility arm segment',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	corridorProbeStepM: {
		value: 5,
		unit: 'm',
		meaning: 'Maximum spacing between dry corridor probes',
		rationale: 'Keeps the established city density and lattice defaults.'
	},
	hubWeightTolerance: {
		value: 1e-9,
		unit: 'ratio',
		meaning: 'Barycentric tolerance when sampling a clamped cap',
		rationale: 'Keeps the established city density and lattice defaults.'
	}
});

const accessibility = defineSettings({
	corridorTurnOptionsRad: setting(
		[-0.85, -0.42, 0, 0.42, 0.85],
		'rad',
		'Candidate heading changes at each corridor step'
	),
	corridorRiseCostScaleM: setting(5, 'm', 'Elevation change per unit of corridor cost'),
	corridorTurnCost: setting(0.9, 'cost/rad', 'Cost per radian of corridor turning'),
	corridorAlignmentBonus: setting(0.25, 'cost', 'Maximum bonus for alignment with the valley'),
	corridorStepRange: setting(
		[8, 23],
		'count',
		'Bounds of the seeded corridor segment count before rounding'
	),
	corridorHeadingOffsetRad: setting(0.29, 'rad', 'Maximum offset of the initial corridor heading'),
	corridorCurvatureRangeRad: setting(
		[0.035, 0.115],
		'rad',
		'Bounds of the seeded turn applied at each segment'
	),
	approachCenterOffsetRangeM: setting(
		[150, 430],
		'm',
		'Distance of the seeded approach center from the crossing head'
	),
	approachCenterBearingOffsetRad: setting(
		1.22,
		'rad',
		'Maximum bearing offset of the approach center'
	),
	approachSpreadRange: setting([1.8, 2.45], 'ratio', 'Seeded radial travel cost per meter'),
	approachEdgeWavelengthM: setting(210, 'm', 'Wavelength of fine approach boundary noise'),
	approachLobeWavelengthM: setting(530, 'm', 'Wavelength of broad approach boundary noise'),
	approachArmCountLimit: setting(4, 'count', 'Exclusive upper bound of seeded arm count'),
	approachBearingOffsetRad: setting(0.42, 'rad', 'Maximum offset of the corridor fan bearing'),
	approachFanWidthRad: setting(2.35, 'rad', 'Angular span of the corridor fan'),
	approachArmSpeedRange: setting(
		[2.7, 4.8],
		'ratio',
		'Bounds of the seeded travel distance discount along an arm'
	),
	approachArmEntryRangeM: setting([5, 90], 'm', 'Bounds of the seeded arm entry cost'),
	approachArmWidthCostRange: setting(
		[1.58, 2.1],
		'ratio',
		'Bounds of distance cost per meter away from an arm'
	),
	approachAspectRange: setting(
		[0.68, 1.6],
		'ratio',
		'Bounds of the seeded radial distance stretch'
	),
	approachPhaseOffsetRad: setting(1.55, 'rad', 'Maximum rotation of the seeded distance ellipse'),
	directApproachEntryM: setting(70, 'm', 'Base cost of travel directly from a crossing head'),
	directApproachCostRatio: setting(
		2.85,
		'ratio',
		'Slope of direct travel cost from a crossing head'
	),
	approachNoiseFadeDistanceM: setting(
		350,
		'm',
		'Distance from the crossing head at which boundary noise reaches full strength'
	),
	approachEdgeAmplitudeM: setting(125, 'm', 'Amplitude of fine boundary noise'),
	approachLobeAmplitudeM: setting(620, 'm', 'Amplitude of broad boundary noise'),
	approachGradeCostM: setting(240, 'm', 'Cost per unit of terrain grade'),
	approachShoreBonusM: setting(18, 'm', 'Maximum cost discount beside the shore'),
	approachShoreDecayM: setting(55, 'm', 'Decay distance of the shore discount'),
	approachBankBiasRangeM: setting(
		[250, 465],
		'm',
		'Bounds of the seeded balance cost favoring one bank'
	)
});

const ranking = defineSettings({
	districtNoiseWavelengthM: setting(
		320,
		'm',
		'Wavelength of district boundary noise, about five coarse cells'
	),
	districtNoiseBaseRatio: setting(0.08, 'ratio', 'Baseline strength of district boundary noise'),
	districtNoiseComplexityRatio: setting(
		0.3,
		'ratio',
		'Increase in district boundary noise at full complexity'
	),
	districtCoreAlongOffsetM: setting(
		450,
		'm',
		'Maximum seeded shift of the main core along its long axis'
	),
	districtCoreAcrossOffsetM: setting(
		60,
		'm',
		'Maximum seeded shift of the main core across its long axis'
	),
	secondaryCoreDistanceMinM: setting(
		700,
		'm',
		'Minimum seeded distance of the second core along the long axis'
	),
	secondaryCoreDistanceMaxM: setting(
		1100,
		'm',
		'Maximum seeded distance of the second core along the long axis'
	),
	secondaryCorePenaltyBaseM: setting(250, 'm', 'Second-core entry cost at full complexity'),
	secondaryCorePenaltySpanM: setting(
		650,
		'm',
		'Additional second-core entry cost at zero complexity'
	)
});

const taper = defineSettings({
	taperStepM: setting(
		5,
		'm',
		'Horizontal corner displacement per level above the lowest surrounding column'
	),
	taperReachShare: setting(
		0.4,
		'ratio',
		'Largest move as a share of the distance to the center of supported columns'
	),
	taperKeysPerMeter: setting(100, 'count/m', 'Plan address key resolution per meter'),
	taperMinimumReachM: setting(1e-6, 'm', 'Minimum length of a taper direction vector'),
	taperLevelTolerance: setting(1e-9, 'levels', 'Rounding allowance at a level plane')
});

const tower = defineSettings({
	towerNoiseBaseRatio: setting(
		0.2,
		'ratio',
		'Baseline strength of seeded height variation in center towers'
	),
	towerNoiseComplexityRatio: setting(
		0.35,
		'ratio',
		'Extra strength of height variation at full complexity'
	)
});

const inputs = defineSettings({
	districtComplexityDefaultRatio: setting(
		0.35,
		'ratio',
		'Default complexity of the city district profile'
	),
	cityTaperLimitRatio: setting(
		1,
		'ratio',
		'Maximum absolute share of the taper field displayed in the city'
	),
	cityTaperDefaultRatio: setting(
		1,
		'ratio',
		'Default share of the taper field displayed in the city'
	),
	cityTaperStepRatio: setting(0.25, 'ratio', 'Step between selectable shares of the taper field')
});

export const cityVolumeInputs = settingValues(inputs);

export const settings = joinSettings(
	base,
	cityVolume,
	accessibility,
	ranking,
	taper,
	tower,
	inputs
);
export const cityVolumeConfig = settingValues(cityVolume);

export const accessibilityDefaults = settingValues(accessibility);

export const rankingDefaults = settingValues(ranking);

export const taperDefaults = settingValues(taper);

export const towerDefaults = settingValues(tower);
