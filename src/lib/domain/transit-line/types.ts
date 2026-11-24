import type { Vec2, Vec3 } from '../../core/geometry';

/** Ordered endpoints of a candidate straight corridor, in world XY meters. */
export type RailCorridor = readonly [Vec2, Vec2];

/** Ground survey at one XY point, with the top of water or terrain and signed dry clearance. */
export type RailGround = Readonly<{ heightM: number; dryClearanceM: number }>;

/** Horizontal outline of an obstruction and its upper elevation. */
export type RailObstacle = Readonly<{ outline: readonly Vec2[]; topM: number }>;

/** Candidate dry ground anchor with a caller-defined plan address. */
export type RailAnchor = Readonly<{ id: string; point: Vec2 }>;

/** An approach preference at one site. The line docks at most once per request. */
export type RailCatchment = Readonly<{ id: string; approaches: readonly RailAnchor[] }>;

/** A station identified by its catchment ID and docked toward an approach address. */
export type RailStation = Readonly<{
	id: string;
	approachId: string;
	position: Vec3;
	base: Vec3;
	stationM: number;
}>;

/** A bearing on the guideway and its dry ground foundation. */
export type RailPier = Readonly<{ top: Vec3; base: Vec3; anchorId?: string }>;

/** A level guideway with two endpoints, foundations and optional station sites. */
export type TransitLine = Readonly<{
	points: readonly [Vec3, Vec3];
	piers: readonly RailPier[];
	stations: readonly RailStation[];
	lengthM: number;
	wetRuns: number;
	gradeRatio: number;
	minimumRadiusM: number;
}>;

/** Numeric constraints can override the defaults. Radii and clearances use meters. */
export type RailConstraints = Readonly<{
	maximumGradeRatio: number;
	minimumRadiusM: number;
	railClearanceM: number;
}>;

/** Survey inputs and preferences. Ordered corridor ties retain the caller's preference order.
 * ID strings are nonempty, opaque addresses unique within their respective lists. */
export type StraightLevelRailSurvey = Readonly<{
	corridors: readonly RailCorridor[];
	readGround: (x: number, y: number) => RailGround;
	/** Conservative upper bound on terrain and water over the entire closed centerline span.
	 * Supply a bound from the terrain model, since point samples cannot rule out a hidden crest. */
	readSpanUpperM: (start: Vec2, end: Vec2) => number;
	/** Optional caller test for a usable connection to the actual elevated platform. */
	acceptsApproach?: (approach: RailAnchor, platform: Vec3) => boolean;
	obstacles?: readonly RailObstacle[];
	anchors?: readonly RailAnchor[];
	/** Requires an addressed pier in regions whose supports must stay on the plan. */
	requiresAnchor?: (point: Vec2) => boolean;
	catchments?: readonly RailCatchment[];
	dockReachM: number;
	/** Optional vertical lattice for the track and its platforms. */
	levels?: Readonly<{ datumM: number; spacingM: number }>;
	constraints?: Partial<RailConstraints>;
}>;
