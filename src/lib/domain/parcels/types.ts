import type { Vec2 } from '../../core/geometry';
import type { DryPlanEdge, TerrainGrid } from '../terrain-grid';

/** A simple oriented outer ring and any clockwise holes, in horizontal meters. Rings close implicitly. */
export type PlanPolygon = readonly (readonly Vec2[])[];

/** The city's lane width and roles, assigned by the caller to one clipped edge. */
export type LaneInput = Readonly<{
	edge: DryPlanEdge;
	hierarchy: readonly string[];
	widthM: number;
	surface: 'walk' | 'stairs';
	/** Assigns the full width inside the single incident cell. Other edges reserve half on each side. */
	oneSided?: boolean;
	protectedFromMerge?: boolean;
}>;

/** One immutable lane interval with permanent incident block addresses. */
export type ParcelLane = Readonly<{
	id: string;
	edgeId: string;
	nodeIds: readonly [string, string];
	provenance: DryPlanEdge['provenance'];
	points: readonly [Vec2, Vec2];
	lengthM: number;
	widthM: number;
	hierarchy: readonly string[];
	surface: LaneInput['surface'];
	blockIds: readonly string[];
}>;

/** Generic holding dimensions and operations, supplied by the caller per kind. */
export type HoldingRule = Readonly<{
	minimumFrontageM: number;
	partition?: Readonly<{ targetAreaM2: number; minimumAreaM2: number }>;
	court?: Readonly<{ insetM: number; passageWidthM: number }>;
	publicUse?: boolean;
}>;

/** Block merge candidates in preferred order, with the kind of each proposed larger holding. */
export type MergeProposal = Readonly<{
	memberCellIds: readonly [string, string];
	plannedKind: string;
}>;

/** Geometry tolerance in meters and the fixed and relative limits on block account rounding. */
export type ParcelTolerance = Readonly<{
	linearToleranceM: number;
	areaToleranceM2: number;
	relativeAreaToleranceRatio: number;
}>;

/** A fixed carrier, reservation policy and holding program. Growth and use decisions belong to the caller. */
export type ParcelPlanInput = Readonly<{
	grid: TerrainGrid;
	lanes: readonly LaneInput[];
	merges?: readonly MergeProposal[];
	plannedKinds: Readonly<Record<string, string>>;
	holdingRules: Readonly<Record<string, HoldingRule>>;
	tolerance: ParcelTolerance;
}>;

/** One usable block with the original cell addresses and a counterclockwise plan boundary. */
export type ParcelBlock = Readonly<{
	id: string;
	memberCellIds: readonly string[];
	plannedKind: string;
	nodeIds: readonly string[];
	outline: readonly Vec2[];
	laneIds: readonly string[];
	grossAreaM2: number;
	laneAreaM2: number;
	laneGround: readonly PlanPolygon[];
	netGround: readonly PlanPolygon[];
	parcelableGround: readonly PlanPolygon[];
	courtFit: 'not-planned' | 'fit' | 'did-not-fit';
	publicGround: Readonly<{
		court: readonly PlanPolygon[];
		passage: readonly PlanPolygon[];
		open: readonly PlanPolygon[];
		entrance?: CourtEntrance;
	}>;
	accounting: Readonly<{
		parcelAreaM2: number;
		passageAreaM2: number;
		courtAreaM2: number;
		openAreaM2: number;
	}>;
}>;

/** A corner address and its current XY position in meters. */
export type HoldingCorner = Readonly<{ id: string; position: Vec2 }>;

/** A connected holding with an implicitly closed CCW outline and a permanent frontage portal. */
export type Parcel = Readonly<{
	id: string;
	blockId: string;
	splitPath: readonly number[];
	plannedKind: string;
	publicUse: boolean;
	outline: readonly Vec2[];
	areaM2: number;
	portalId: string;
}>;

/** A realized parcel with stable corner keys and its implicitly closed CCW ring. */
export type AddressedParcel = Parcel & Readonly<{ corners: readonly HoldingCorner[] }>;

/** Contiguous contact between a parcel and the public side of an addressed lane. */
export type ParcelPortal = Readonly<{
	id: string;
	parcelId: string;
	/** Supporting parcel side, from start to end in CCW ring order. */
	side: readonly [string, string];
	laneId: string;
	points: readonly [Vec2, Vec2];
	frontageM: number;
}>;

/** An entrance where a public court passage meets an addressed lane. */
export type CourtEntrance = Omit<ParcelPortal, 'parcelId' | 'side'> & Readonly<{ blockId: string }>;
