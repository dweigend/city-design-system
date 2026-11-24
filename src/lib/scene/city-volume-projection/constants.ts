/**
 * Presentation constants of the city volume projection: every tunable number of the city display,
 * named with its unit and meaning. Colours and alphas of surfaces stay CSS tokens in `app.css` and
 * the surface table; the projection code reads its numbers only from here. The file has no
 * imports, so a central configuration can move or re-export it without touching the logic.
 * Unitless shares run from 0 to 1; widths are CSS pixels; offsets of face values are Oklab
 * lightness.
 */

// Camera and fit.

/** Bearing of the city camera from north, in radians: one face of a box stays in shade. */
export const cityCameraBearingRad = (34 * Math.PI) / 180;
/** Share of the frame the fitted city fills on flat ground. */
export const cityFrameFillFlat = 0.92;
/** Share of the frame given back per unit of relief, so Auto can raise ground and roofs. */
export const cityFrameFillPerRelief = 0.2;
/** Smallest explicit city camera frame width, in meters. */
export const cityCameraMinimumWidthM = 120;
/** Camera elevation at quarter zoom, in degrees. */
export const quarterElevationDeg = 32;
/** Camera elevation over a whole flat city, in degrees; the whole-city view never sits below the
 * quarter elevation. */
export const cityElevationFlatDeg = 24;
/** Extra camera elevation over a whole city per unit of relief, in degrees. */
export const cityElevationPerReliefDeg = 38;
/** Frame widths in meters over which the camera rises from the quarter to the whole city. */
export const cityElevationRangeM = [500, 2300] as const;

// Height profile and fades, by zoom.

/** Projected peak height as a share of the frame width at a broad view of a city. */
export const peakFrameShare = 0.1;
/** Projected peak height as a share of the frame width for a town. */
export const townFrameShare = 0.014;
/** Peak heights in level counts over which the target moves from town to city. */
export const peakTransitionLevels = [3, 6] as const;
/** Zoom range in true meters per CSS pixel over which diagonals and other model members fade. */
export const detailFadeMPerPx = [0.7, 3.2] as const;
/** Zoom range in meters per CSS pixel over which uprights fade. */
export const uprightFadeMPerPx = [1.55, 3.65] as const;
/** Zoom range in meters per CSS pixel over which floor chords fade. */
export const rimFadeMPerPx = [2.2, 3.85] as const;
/** Zoom range in meters per CSS pixel over which Auto exaggerates height. */
export const heightFadeMPerPx = [0.7, 3.15] as const;
/** Zoom range in meters per CSS pixel over which the envelope veil grows over the lattice. */
export const envelopeFadeMPerPx = [1.25, 3.85] as const;
/** Zoom range in meters per CSS pixel over which the taper appears; it follows the detail fade, so
 * the taper is zero while members are drawn. */
export const taperFadeMPerPx = detailFadeMPerPx;
/** Frame widths in meters over which the taper may appear at all: zero at the 500 m quarter even
 * on a narrow canvas, where meters per pixel alone would already let it in. */
export const taperFadeWidthM = [600, 1600] as const;

// Stock boxes.

/** Street half-width in meters between the stock box of a column and its plan cell edge. */
export const stockBoxInsetM = 7;
/** A box keeps at least this share of its cell's size. */
export const stockBoxMinShare = 0.45;
/** Depth in meters a box sinks below its lowest corner so it meets sloped ground. */
export const stockBoxFootingM = 0.5;

// Ground shade.

/** Length of the dark contact band per meter of body height. */
export const contactShadeReachPerM = 0.14;
/** Share of a body's shade strength given to its long cast shadow. */
export const castShadeShare = 0.5;

// Lattice.

/** Radius in meters of a lattice joint glyph. */
export const latticeJointRadiusM = 0.92;
/** A member whose ends differ by less than this height in meters is a floor chord. */
export const chordRiseMaxM = 0.05;
/** A rising member whose horizontal run is at most this share of its rise is an upright; any
 * steeper slant is a model's own member: a diagonal, a twist or a branch. */
export const uprightRunPerRise = 0.12;

// Plan lines.

/** Height in meters at which plan lines float over ground and water. */
export const planLineLiftM = 0.32;
/** Height in meters above the sampled surface for the crossing overlay (COLOR-3). */
export const crossingLiftM = 1.2;

// Body looks by display level.

/** Face values of a body as Oklab lightness offsets of its colour: light roofs, a lit wall and a
 * wall in shade, so every body shows two or three clear values. */
export type FaceValues = Readonly<{ top: number; lit: number; shadow: number }>;

/** One drawing weight: opacity share and width in CSS pixels. */
export type Stroke = Readonly<{ opacity: number; width: number }>;

/** How a district body reads at one visible level. */
export type BodyLook = Readonly<{
	/** Neutral stock surface the level draws with; none keeps the district colour. */
	surface?: 'veil' | 'pencil';
	/** Opacity share of the fill. */
	fill: number;
	faces: FaceValues;
	/** Roof edges at steps and borders, and the roof ring of a box: the strongest line. */
	roof: Stroke;
	/** Wall corners and the ground line of a body. */
	walls: Stroke;
	/** Level lines on the walls. */
	storeys: Stroke;
	/** Plan cell joints across a roof of equal height. */
	joints: Stroke;
	/** Share of a stroke's opacity kept where a nearer body covers it. */
	hidden: number;
	/** Share of a stroke's opacity the farthest stroke of the picture loses. */
	recede: number;
	/** Strength of pencil hatching on the faces turned from the sun. */
	hatch: number;
	/** Strength of the ground shade under the body. */
	shade: number;
}>;

/** The focused subject: opaque district colour with light roofs, deep shade walls, dark hairline
 * edges, level lines and cell joints, so full shows more than the stock. */
const fullLook: BodyLook = {
	fill: 1,
	faces: { top: 0.08, lit: -0.03, shadow: -0.14 },
	roof: { opacity: 0.95, width: 1.05 },
	walls: { opacity: 0.8, width: 0.8 },
	storeys: { opacity: 0.42, width: 0.6 },
	joints: { opacity: 0.32, width: 0.55 },
	hidden: 0,
	recede: 0.25,
	hatch: 0,
	shade: 1
};

/** Body looks per visible level. Stock draws hairline graphite edges on a pale see-through body
 * with nearly white roofs; edges behind a body stay faintly visible through it. */
export const bodyLooks = {
	full: fullLook,
	silhouette: {
		surface: 'veil',
		fill: 1,
		faces: { top: 0.03, lit: -0.04, shadow: -0.11 },
		roof: { opacity: 0.85, width: 0.85 },
		walls: { opacity: 0.6, width: 0.65 },
		storeys: { opacity: 0, width: 0.5 },
		joints: { opacity: 0, width: 0.5 },
		hidden: 0,
		recede: 0.3,
		hatch: 0,
		shade: 0.9
	},
	transparent: {
		surface: 'veil',
		fill: 0.6,
		faces: { top: 0.035, lit: -0.035, shadow: -0.12 },
		roof: { opacity: 0.88, width: 0.8 },
		walls: { opacity: 0.62, width: 0.62 },
		storeys: { opacity: 0, width: 0.5 },
		joints: { opacity: 0, width: 0.5 },
		hidden: 0.3,
		recede: 0.35,
		hatch: 0,
		shade: 0.6
	},
	pencil: {
		surface: 'pencil',
		fill: 0.8,
		faces: { top: 0.035, lit: -0.03, shadow: -0.1 },
		roof: { opacity: 0.95, width: 0.95 },
		walls: { opacity: 0.8, width: 0.75 },
		storeys: { opacity: 0.4, width: 0.55 },
		joints: { opacity: 0, width: 0.5 },
		hidden: 0.32,
		recede: 0.3,
		hatch: 1,
		shade: 0.75
	}
} as const satisfies Record<'full' | 'silhouette' | 'transparent' | 'pencil', BodyLook>;

/** Out-of-focus edges keep this share of their opacity once member detail has faded from afar. */
export const farStockEdgeShare = 0.5;

// Lattice members over the envelope.

/** How a member rank draws: opacity share, width in CSS pixels, the share kept behind a body and
 * the share lost at the far end of the picture. */
export type MemberLook = Readonly<{
	opacity: number;
	width: number;
	hidden: number;
	recede: number;
}>;

/** Member weights by rank. Floor chords carry the stepped mass; each model's own members (diagonals,
 * twists, branches) come second and stay clear behind the veil so models keep apart; plain
 * uprights, common to every model, are the quietest. */
export const memberLooks = {
	lattice: { opacity: 0.9, width: 1, hidden: 0.4, recede: 0.4 },
	uprights: { opacity: 0.55, width: 0.65, hidden: 0.25, recede: 0.45 },
	detail: { opacity: 1, width: 1.1, hidden: 0.65, recede: 0.2 }
} as const satisfies Record<'lattice' | 'uprights' | 'detail', MemberLook>;

/** Share of a member's width kept once its rank has faded from afar. */
export const fadedMemberWidth = 0.5;

/** The envelope outline over a visible lattice: the stepped silhouette is the strongest line. */
export const silhouetteOverLattice: Stroke = { opacity: 0.85, width: 1.35 };
/** Fill opacity of an out-of-focus envelope around a visible lattice. Hidden members draw after
 * the veil, so the veil calms the ground below without hiding the structure. */
export const veilOverLattice = 0.55;
/** Fill opacity of a focused envelope over its lattice up close; it grows to opaque with the
 * envelope fade from afar. */
export const focusVeilNearLattice = 0.035;
/** Share of a visible member's opacity at any level below full. */
export const quietMembers = 0.45;

// Plan lines by display level.

/** Share of a plan line's opacity at the transparent level, where it is a trace under the city. */
export const planTraceShare = 0.4;
/** Share of a plan line's width at the transparent level. */
export const planTraceWidthShare = 0.8;
