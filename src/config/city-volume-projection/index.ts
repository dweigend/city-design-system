import { defineSettings, joinSettings, settingValues } from '../setting';
import { lookSettings } from './looks';

export {
	bodyLooks,
	memberLooks,
	silhouetteOverLattice,
	type BodyLook,
	type FaceValues,
	type MemberLook,
	type Stroke
} from './looks';

const projectionSettings = defineSettings({
	cityCameraBearingRad: {
		value: (34 * Math.PI) / 180,
		unit: 'rad',
		meaning: 'Bearing of the city camera from north, in radians',
		rationale: 'Keeps one box wall in shade.'
	},
	cityFrameFillFlat: {
		value: 0.92,
		unit: 'ratio',
		meaning: 'Share of the frame the fitted city fills on flat ground',
		rationale: 'Leaves margins around the fitted city.'
	},
	cityFrameFillPerRelief: {
		value: 0.2,
		unit: 'ratio/relief',
		meaning: 'Share of the frame given back per unit of relief, so Auto can raise ground and roofs',
		rationale: 'Makes room for raised ground and roofs as relief increases.'
	},
	cityCameraMinimumWidthM: {
		value: 120,
		unit: 'm',
		meaning: 'Smallest explicit city camera frame width, in meters',
		rationale: 'Keeps a close view wide enough to frame a group of buildings.'
	},
	quarterElevationDeg: {
		value: 32,
		unit: 'deg',
		meaning: 'Camera elevation at quarter zoom, in degrees',
		rationale: 'Shows the quarter in depth while keeping the facades visible.'
	},
	cityElevationFlatDeg: {
		value: 24,
		unit: 'deg',
		meaning: 'Camera elevation over a whole flat city, in degrees',
		rationale: 'Sets the whole-city tilt before applying the quarter minimum.'
	},
	cityElevationPerReliefDeg: {
		value: 38,
		unit: 'deg/relief',
		meaning: 'Extra camera elevation over a whole city per unit of relief, in degrees',
		rationale: 'Raises the view as relief obscures more of the plan.'
	},
	cityElevationRangeM: {
		value: [500, 2300],
		unit: 'm',
		meaning:
			'Frame widths in meters over which the camera rises from the quarter to the whole city',
		rationale: 'Blends the quarter and whole-city tilts over the overview zoom range.'
	},
	peakFrameShare: {
		value: 0.1,
		unit: 'ratio',
		meaning: 'Projected peak height as a share of the frame width at a broad view of a city',
		rationale: 'Makes the skyline readable in a broad view.'
	},
	townFrameShare: {
		value: 0.014,
		unit: 'ratio',
		meaning: 'Projected peak height as a share of the frame width for a town',
		rationale: 'Keeps smaller settlements visually low.'
	},
	peakTransitionLevels: {
		value: [3, 6],
		unit: 'levels',
		meaning: 'Peak heights in level counts over which the target moves from town to city',
		rationale: 'Blends between the town and city skyline targets.'
	},
	detailFadeMPerPx: {
		value: [0.7, 3.2],
		unit: 'm/px',
		meaning:
			'Zoom range in true meters per CSS pixel over which diagonals and other model members fade',
		rationale: 'Suppresses diagonal members as their spacing becomes too fine to read.'
	},
	uprightFadeMPerPx: {
		value: [1.55, 3.65],
		unit: 'm/px',
		meaning: 'Zoom range in meters per CSS pixel over which uprights fade',
		rationale: 'Lets common uprights recede as the view widens.'
	},
	rimFadeMPerPx: {
		value: [2.2, 3.85],
		unit: 'm/px',
		meaning: 'Zoom range in meters per CSS pixel over which floor chords fade',
		rationale: 'Retains the floor chords while they still describe the stepped mass.'
	},
	heightFadeMPerPx: {
		value: [0.7, 3.15],
		unit: 'm/px',
		meaning: 'Zoom range in meters per CSS pixel over which Auto exaggerates height',
		rationale: 'Allows true heights near the subject and exaggeration in overview.'
	},
	envelopeFadeMPerPx: {
		value: [1.25, 3.85],
		unit: 'm/px',
		meaning:
			'Zoom range in meters per CSS pixel over which the envelope veil grows over the lattice',
		rationale: 'Gradually replaces the exposed lattice with a readable mass.'
	},
	taperFadeWidthM: {
		value: [600, 1600],
		unit: 'm',
		meaning: 'Frame widths in meters over which the taper may appear at all',
		rationale: 'Keeps taper absent in the quarter view even on a narrow canvas.'
	},
	stockBoxInsetM: {
		value: 7,
		unit: 'm',
		meaning: 'Street half-width in meters between the stock box of a column and its plan cell edge',
		rationale: 'Leaves a readable street between neighboring stock boxes.'
	},
	stockBoxMinShare: {
		value: 0.45,
		unit: 'ratio',
		meaning: "A box keeps at least this share of its cell's size",
		rationale: 'Prevents the inset from collapsing narrow cells.'
	},
	stockBoxFootingM: {
		value: 0.5,
		unit: 'm',
		meaning: 'Depth in meters a box sinks below its lowest corner so it meets sloped ground',
		rationale: 'Seats the box in the local ground.'
	},
	contactShadeReachPerM: {
		value: 0.14,
		unit: 'm/m',
		meaning: 'Length of the dark contact band per meter of body height',
		rationale: 'Keeps the contact band tight to the building base.'
	},
	castShadeShare: {
		value: 0.5,
		unit: 'ratio',
		meaning: "Share of a body's shade strength given to its long cast shadow",
		rationale: 'Softens the long band relative to the contact band.'
	},
	latticeJointRadiusM: {
		value: 0.92,
		unit: 'm',
		meaning: 'Radius in meters of a lattice joint glyph',
		rationale: 'Makes joint glyphs visible without hiding their members.'
	},
	chordRiseMaxM: {
		value: 0.05,
		unit: 'm',
		meaning: 'A member whose ends differ by less than this height in meters is a floor chord',
		rationale: 'Treats nearly level members as floor chords.'
	},
	latticeUprightRunPerRise: {
		value: 0.12,
		unit: 'm/m',
		meaning: 'A rising member whose horizontal run is at most this share of its rise is an upright',
		rationale: 'Distinguishes uprights from model-specific diagonals.'
	},
	planLineLiftM: {
		value: 0.32,
		unit: 'm',
		meaning: 'Height in meters at which plan lines float over ground and water',
		rationale: 'Keeps the plan overlay clear of the drawn surface.'
	},
	overlayClipPrecisionDigits: {
		value: 8,
		unit: 'decimal digits',
		meaning:
			'Decimal digits in meters for clipping fills to rendered terrain facets, the ClipperD limit',
		rationale: 'Uses the maximum decimal precision accepted by ClipperD.'
	},
	crossingLiftM: {
		value: 1.2,
		unit: 'm',
		meaning: 'Height in meters above the sampled surface for the crossing overlay (COLOR-3)',
		rationale: 'Keeps crossing markers legible over other plan overlays.',
		principle: 'COLOR-3'
	},
	farStockEdgeShare: {
		value: 0.5,
		unit: 'ratio',
		meaning:
			'Out-of-focus edges keep this share of their opacity once member detail has faded from afar',
		rationale: 'Leaves a quiet stock outline after lattice detail fades.'
	},
	fadedMemberWidth: {
		value: 0.5,
		unit: 'ratio',
		meaning: "Share of a member's width kept once its rank has faded from afar",
		rationale: 'Thins a rank as it loses prominence.'
	},
	veilOverLattice: {
		value: 0.55,
		unit: 'ratio',
		meaning:
			'Fill opacity of an out-of-focus envelope around a visible lattice. Hidden members draw after the veil, so the veil calms the ground below without hiding the structure',
		rationale: 'Subdues the ground under the lattice while hidden strokes remain visible.'
	},
	focusVeilNearLattice: {
		value: 0.035,
		unit: 'ratio',
		meaning: 'Fill opacity of a focused envelope over its lattice up close',
		rationale: 'Keeps the close lattice visible through the focused envelope.'
	},
	quietMembers: {
		value: 0.45,
		unit: 'ratio',
		meaning: "Share of a visible member's opacity at any level below full",
		rationale: 'Subdues member lines in lower focus levels.'
	},
	planTraceShare: {
		value: 0.4,
		unit: 'ratio',
		meaning:
			"Share of a plan line's opacity at the transparent level, where it is a trace under the city",
		rationale: 'Subdues the plan at the transparent focus level.'
	},
	planTraceWidthShare: {
		value: 0.8,
		unit: 'ratio',
		meaning: "Share of a plan line's width at the transparent level",
		rationale: 'Makes the transparent plan read as a trace.'
	},
	cityAnchorBarycentricTolerance: {
		value: 1e-9,
		unit: 'ratio',
		meaning: 'Allowance at a rendered ground triangle edge',
		rationale: 'Accepts anchors on shared edges despite roundoff.'
	},
	cityAnchorBucketM: {
		value: 50,
		unit: 'm',
		meaning: 'XY bucket side for ground triangles queried by plan overlays',
		rationale: 'Limits local ground queries to nearby triangles.'
	},
	parcelDetailLiftRatio: {
		value: 3,
		unit: 'ratio',
		meaning: 'Parcel detail lift relative to the plan-line lift',
		rationale: 'Draws parcel detail over the plan overlay.'
	},
	cityProjectionDefaultSeed: {
		value: 0,
		unit: 'seed',
		meaning: 'Pencil stock seed when none is supplied',
		rationale: 'Keeps the distribution stable for callers without a world seed.'
	},
	stockInsetMinEdgeM: {
		value: 1e-6,
		unit: 'm',
		meaning: 'Minimum edge length considered by the stock inset',
		rationale: 'Avoids unstable apothem calculations on tiny segments.'
	},
	stockStoreyTopToleranceM: {
		value: 1e-6,
		unit: 'm',
		meaning: 'Vertical exclusion band below the stock roof',
		rationale: 'Avoids a duplicate storey stroke at the roof plane.'
	},
	envelopeFirstLevelTolerance: {
		value: 1e-9,
		unit: 'levels',
		meaning: 'Tolerance before rounding the first wall level up',
		rationale: 'Keeps a level aligned with the floor despite division roundoff.'
	},
	envelopeLevelPlaneToleranceM: {
		value: 1e-9,
		unit: 'm',
		meaning: 'Exclusion distance around the floor and roof planes',
		rationale: 'Avoids duplicate wall endpoints near the boundary planes.'
	}
});

export const settings = joinSettings(projectionSettings, lookSettings);

export const defaults = settingValues(settings);

export const {
	cityCameraBearingRad,
	cityFrameFillFlat,
	cityFrameFillPerRelief,
	cityCameraMinimumWidthM,
	quarterElevationDeg,
	cityElevationFlatDeg,
	cityElevationPerReliefDeg,
	cityElevationRangeM,
	peakFrameShare,
	townFrameShare,
	peakTransitionLevels,
	detailFadeMPerPx,
	uprightFadeMPerPx,
	rimFadeMPerPx,
	heightFadeMPerPx,
	envelopeFadeMPerPx,
	taperFadeWidthM,
	stockBoxInsetM,
	stockBoxMinShare,
	stockBoxFootingM,
	contactShadeReachPerM,
	castShadeShare,
	latticeJointRadiusM,
	chordRiseMaxM,
	latticeUprightRunPerRise,
	planLineLiftM,
	overlayClipPrecisionDigits,
	crossingLiftM,
	farStockEdgeShare,
	fadedMemberWidth,
	veilOverLattice,
	focusVeilNearLattice,
	quietMembers,
	planTraceShare,
	planTraceWidthShare,
	cityProjectionDefaultSeed,
	stockInsetMinEdgeM,
	stockStoreyTopToleranceM,
	envelopeFirstLevelTolerance,
	envelopeLevelPlaneToleranceM
} = defaults;
/** Taper follows the detail fade so focused members stay straight while visible. */
export const taperFadeMPerPx = detailFadeMPerPx;
