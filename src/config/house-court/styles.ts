import { defineSettings } from '../setting';

type Unit = 'm' | 'ratio' | 'storeys' | 'count';
const s = (value: number, unit: Unit, meaning: string, principle: string) => ({
	value,
	unit,
	meaning,
	principle,
	bounds: unit === 'count' ? { min: 1 } : { min: 0 }
});

/** Memphis row: bold primitive solids stacked and offset, flat colour blocks, figures as openings. */
export const memphis = defineSettings({
	memphisRearDropRatio: s(
		0.2,
		'ratio',
		'Rear height loss of the Memphis row at complexity 1',
		'FORM-2'
	),
	memphisJitterShareRatio: s(0.95, 'ratio', 'Share of Memphis cells that rise or fall', 'FORM-2'),
	memphisJitterStoreys: s(2, 'storeys', 'Largest rise or fall of one Memphis cell', 'FORM-2'),
	memphisInsetM: s(0.45, 'm', 'Gap kept between a Memphis solid and its cell sides', 'FORM-2'),
	memphisStackShareRatio: s(
		0.7,
		'ratio',
		'Share of Memphis runs split into two stacked, offset solids',
		'FORM-2'
	),
	memphisStackInsetM: s(
		1.4,
		'm',
		'Extra inset of the upper solid of a split Memphis run',
		'FORM-2'
	),
	memphisRoofRiseRatio: s(
		0.95,
		'ratio',
		'Height of a Memphis roof solid as a share of one storey',
		'FORM-2'
	),
	memphisOpeningPitchM: s(7, 'm', 'Wall length per Memphis figure opening', 'FORM-2'),
	memphisOpeningShareRatio: s(
		0.3,
		'ratio',
		'Share of exposed Memphis wall storeys that carry a figure',
		'FORM-2'
	),
	memphisOpeningSizeM: s(0.95, 'm', 'Radius of a Memphis figure opening', 'FORM-2')
});

/** Archigram row: a grey hairline frame on the cell edges carrying plug-in capsules and services. */
export const archigram = defineSettings({
	archigramJitterShareRatio: s(
		0.35,
		'ratio',
		'Share of Archigram frame columns that rise or fall',
		'FORM-3'
	),
	archigramGroundOpenRatio: s(
		1,
		'ratio',
		'Share of Archigram cells standing on an open ground storey',
		'FORM-3'
	),
	archigramCapsuleShareRatio: s(
		0.62,
		'ratio',
		'Share of framed Archigram cell storeys holding a capsule',
		'FORM-3'
	),
	archigramCapsuleInsetM: s(
		0.7,
		'm',
		'Gap between an Archigram capsule and its cell sides',
		'FORM-3'
	),
	archigramCapsuleGapM: s(0.45, 'm', 'Vertical clearance of a capsule within its storey', 'FORM-3'),
	archigramBarM: s(0.16, 'm', 'Side of a frame bar section', 'FORM-6'),
	archigramBraceShareRatio: s(
		0.55,
		'ratio',
		'Share of exposed frame bays with a diagonal at complexity 1',
		'FORM-6'
	),
	archigramTubeShareRatio: s(
		0.35,
		'ratio',
		'Share of outer frame corners with a service tube at complexity 1',
		'COLOR-4'
	),
	archigramTubeRadiusM: s(0.32, 'm', 'Radius of a service tube', 'COLOR-4'),
	archigramMastStoreys: s(
		2,
		'storeys',
		'Height of the mast above the tallest frame column',
		'FORM-3'
	),
	archigramOpeningPitchM: s(2.6, 'm', 'Capsule wall length per porthole', 'FORM-3'),
	archigramOpeningShareRatio: s(
		0.8,
		'ratio',
		'Share of exposed capsule sides that carry a porthole',
		'FORM-3'
	),
	archigramOpeningSizeM: s(0.42, 'm', 'Porthole radius', 'FORM-3')
});

/** Organic row: rounded cell pods stepping down to the court in planted terraces. */
export const organic = defineSettings({
	organicRearDropRatio: s(
		1,
		'ratio',
		'Rear height loss of the organic row at complexity 1',
		'FORM-1'
	),
	organicJitterShareRatio: s(0.3, 'ratio', 'Share of organic cells that rise or fall', 'FORM-1'),
	organicInsetM: s(0.12, 'm', 'Gap kept between an organic pod and its cell sides', 'FORM-1'),
	organicRoundShareRatio: s(
		0.72,
		'ratio',
		'Corner radius of an organic pod as a share of its cell inradius',
		'FORM-1'
	),
	organicRoofRiseRatio: s(
		0.75,
		'ratio',
		'Height of an organic dome as a share of one storey',
		'FORM-1'
	),
	organicOpeningPitchM: s(4.6, 'm', 'Wall length per round organic opening', 'FORM-2'),
	organicOpeningShareRatio: s(
		0.55,
		'ratio',
		'Share of exposed organic wall storeys that carry an opening',
		'FORM-2'
	),
	organicOpeningSizeM: s(0.8, 'm', 'Radius of a round organic opening', 'FORM-2'),
	organicTreeShareRatio: s(
		0.75,
		'ratio',
		'Share of court cells holding a tree at complexity 1',
		'FORM-8'
	),
	organicPlanterM: s(0.55, 'm', 'Width and height of a planted terrace edge', 'FORM-8')
});

/** Shared shape settings of the style generators. */
export const shapes = defineSettings({
	curveSegments: s(
		16,
		'count',
		'Segments of a full circle in rounded fills, domes and figures',
		'FORM-2'
	),
	domeRings: s(4, 'count', 'Rings of a dome between its base and apex', 'FORM-2'),
	roundBlockShareRatio: s(
		0.92,
		'ratio',
		'Corner radius of a round primitive as a share of its cell inradius',
		'FORM-2'
	),
	chamferShareRatio: s(
		0.4,
		'ratio',
		'Chamfer of a cut primitive as a share of its cell inradius',
		'FORM-2'
	),
	wedgeLowRatio: s(
		0.12,
		'ratio',
		'Low edge of a mono-pitch wedge as a share of its rise',
		'FORM-2'
	),
	figureDepthM: s(0.16, 'm', 'Thickness of an opening figure, centred on its wall', 'FORM-3'),
	collarShareRatio: s(1.35, 'ratio', 'Collar radius as a share of its opening radius', 'FORM-5'),
	treeTrunkM: s(0.25, 'm', 'Side of a court tree trunk', 'FORM-8'),
	treeHeightM: s(5.5, 'm', 'Height of a court tree', 'FORM-8'),
	treeCrownM: s(2.2, 'm', 'Radius of a court tree crown', 'FORM-8'),
	capShareRatio: s(
		0.55,
		'ratio',
		'Planted cap of a dome: its plan size and rise as shares of the dome',
		'FORM-8'
	),
	insetLimitRatio: s(
		0.6,
		'ratio',
		'Largest inset of a fill as a share of its cell inradius',
		'FORM-9'
	),
	frameDeckThicknessM: s(0.2, 'm', 'Thickness of a frame deck', 'FORM-6'),
	figureOpeningClearanceDivisor: s(
		3,
		'ratio',
		'Minimum span in opening radii to leave clearance around a figure',
		'FORM-5'
	),
	chamferMaximumEdgeShareRatio: s(
		1 / 3,
		'ratio',
		'Largest share of an edge cut by one chamfer',
		'FORM-2'
	),
	mastBarM: s(0.12, 'm', 'Side of a mast bar', 'FORM-6'),
	tubeCornerInsetRatio: s(
		1 / 8,
		'ratio',
		'Share of the service tube radius left out of the corner rounding',
		'FORM-6'
	),
	tubeRoofRiseStoreyDivisor: s(
		2,
		'ratio',
		'Divisor of one storey height for service tube extension above the roof',
		'FORM-6'
	),
	mastArmReachRatio: s(
		1 / 4,
		'ratio',
		'Mast arm reach from the pole as a share of the cell edge',
		'FORM-6'
	),
	mastUpperBarOffsetRatio: s(
		4,
		'ratio',
		'Upper crossbar distance below the mast top in bar widths',
		'FORM-6'
	),
	mastLowerBarOffsetRatio: s(
		8,
		'ratio',
		'Lower crossbar distance below the mast top in bar widths',
		'FORM-6'
	),
	mastPoleGaugeRatio: s(2, 'ratio', 'Pole width in crossbar widths', 'FORM-6')
});
