import type { Vec2, Vec3 } from '../../core/geometry';
import type { HouseStyleName } from '../../domain/house-court';
import type { StoreyProgram } from '../../domain/massing';
import type { Part, PlaceableObject } from '../../core/object';
import type { TransitLine, RailStation } from '../../domain/transit-line';
import type { MovementEdge } from '../../domain/movement-network';
import type { AddressedParcel, ParcelLane, ParcelPortal } from '../../domain/parcels';
import type { HostAddress, Placement } from '../asset-registry';
import type { CityCrossing, CityPlanVariant } from '../city-site';

/** Fixed inputs for one settlement history, with distances in meters and dates in calendar years. */
export type CityGrowthRecipe = Readonly<{
	planFamily: CityPlanVariant;
	carrierSizeM: number;
	startYear: number;
	endYear: number;
	stepYears: number;
	minimumFoundingHoldings: number;
	holdingsPerStep: number;
	maximumActiveHoldings: number;
	maximumLaneHops: number;
	initialStoreys: number;
	buildingRadiusShare: number;
	minimumFloodFreeboardM: number;
	preferredTerraceHeightM: number;
	terraceHeightScaleM: number;
	shelterProbeDistanceM: number;
	shelterRiseScaleM: number;
	waterSearchRadiusM: number;
	landingDistanceScaleM: number;
	accessDistanceScaleM: number;
	terraceWeight: number;
	landingWeight: number;
	slopeWeight: number;
	shelterWeight: number;
	neighborWeight: number;
	laneAccessWeight: number;
	seedVariationWeight: number;
	eras?: readonly CityConstructionEra[];
	stockChanges?: readonly CityStockChange[];
	protectedHoldingIds?: readonly string[];
	development?: CityGrowthDevelopment;
}>;

/** Enables infrastructure and the area-driven skyline. Dates are earliest eligible budget years. */
export type CityGrowthDevelopment = Readonly<{
	crossingFromYear?: number;
	railFromYear?: number;
}>;

/** Calendar threshold and construction style, with optional edits to new upper storeys. */
export type CityConstructionEra = Readonly<{
	fromYear: number;
	styleId: HouseStyleName;
	setbackDepth?: number;
	porosityRatio?: number;
}>;

type DatedTarget = Readonly<{ year: number; holdingId?: string }>;
type Use = StoreyProgram['use'];

/** One dated stock change. Without a holding ID, selects one eligible holding by seed. */
export type CityStockChange = DatedTarget &
	(
		| Readonly<{ kind: 'infill' | 'extend'; storeys: number; use?: Use }>
		| Readonly<{ kind: 'convert'; use: Use; fromUse?: Use; partId?: string }>
		| Readonly<{ kind: 'retire' | 'split' }>
	);

/** Open cell route in portal-to-court order. The final cell is the reserved court. */
export type CityGrowthCourtAccess = Readonly<{
	cellIds: readonly string[];
	polygons: readonly (readonly Vec2[])[];
}>;

/** The entire addressed parcel, its frontage portal and its original source cells. */
export type CityGrowthHolding = AddressedParcel &
	Readonly<{
		portal: ParcelPortal;
		memberCellIds: readonly string[];
		builtYear: number;
		protected: boolean;
		parentHoldingId?: string;
		courtAccess?: CityGrowthCourtAccess;
		centerId?: string;
	}>;

/** A public lane interval dated at its first use by the settlement. */
export type CityGrowthLane = ParcelLane & Readonly<{ builtYear: number }>;

/** Dated geometry with a stable floor address relative to the common vertical datum. */
export type CityGrowthPart = Part &
	Readonly<{
		kind: 'foundation' | 'storey';
		datumIndex: number;
		builtYear: number;
		styleId: HouseStyleName;
		use: Use;
		cellId?: string;
		convertedYear?: number;
	}>;

/** A dated building anchored to its holding, with parts listed in construction order. */
export type CityGrowthBuilding = Readonly<{
	id: string;
	holdingId: string;
	builtYear: number;
	styleId: HouseStyleName;
	use: Use;
	parts: readonly CityGrowthPart[];
}>;

export type EventDate = Readonly<{ year: number; sequence: number }>;

/** One dated physical bridge or guideway segment on the world datum. */
export type CityInfrastructurePart = Readonly<{
	id: string;
	kind: 'deck' | 'bearing' | 'track' | 'platform' | 'dock';
	datumIndex: number;
	builtYear: number;
	points: readonly Vec3[];
}>;

export type CrossingBuilt = EventDate &
	Readonly<{
		kind: 'crossing-built';
		crossing: CityCrossing;
		fromNodeId: string;
		toNodeId: string;
		parts: readonly CityInfrastructurePart[];
		lanes: readonly CityGrowthLane[];
		unlockedHoldingIds: readonly string[];
	}>;

export type SquareReserved = EventDate &
	Readonly<{
		kind: 'square-reserved';
		holding: CityGrowthHolding;
		nodeId: string;
		lanes: readonly CityGrowthLane[];
	}>;

export type RailOpened = EventDate &
	Readonly<{
		kind: 'rail-opened';
		id: string;
		line: Omit<TransitLine, 'stations'>;
		parts: readonly CityInfrastructurePart[];
	}>;

export type StationOpened = EventDate &
	Readonly<{
		kind: 'station-opened';
		id: string;
		railId: string;
		station: RailStation;
		dock: readonly MovementEdge[];
		catchmentHoldingIds: readonly string[];
		lanes: readonly CityGrowthLane[];
		parts: readonly CityInfrastructurePart[];
	}>;

/** A registered public object placed at a physical address with a dated anchor in world meters. */
export type CityGrowthAsset = Readonly<{
	id: string;
	assetId: string;
	host: HostAddress;
	anchor: Vec3;
	builtYear: number;
	seed: number;
	params: Placement['params'];
	object: PlaceableObject;
}>;

export type AssetPlaced = EventDate & Readonly<{ kind: 'asset-placed'; asset: CityGrowthAsset }>;

export type HoldingSettled = EventDate &
	Readonly<{
		kind: 'holding-settled';
		reason: 'founding' | 'expansion';
		holding: CityGrowthHolding;
		lanes: readonly CityGrowthLane[];
		building: CityGrowthBuilding;
	}>;

type BuildingEdit = EventDate & Readonly<{ buildingId: string; holdingId: string }>;

type BuildingAddition<Kind extends 'building-infill' | 'building-extended'> = BuildingEdit &
	Readonly<{
		kind: Kind;
		parts: readonly CityGrowthPart[];
	}>;

type BuildingConverted = BuildingEdit &
	Readonly<{
		kind: 'building-converted';
		partIds: readonly string[];
		use: Use;
		convertedYear: number;
	}>;

type BuildingRetired = BuildingEdit & Readonly<{ kind: 'building-retired'; retiredYear: number }>;

type HoldingSplit = EventDate &
	Readonly<{
		kind: 'holding-split';
		predecessorId: string;
		childIds: readonly [string, string];
		children: readonly [CityGrowthHolding, CityGrowthHolding];
	}>;

/** A dated transaction, ordered by calendar year and zero-based sequence within that year. */
export type CityGrowthEvent =
	| HoldingSettled
	| BuildingAddition<'building-infill'>
	| BuildingAddition<'building-extended'>
	| BuildingConverted
	| BuildingRetired
	| HoldingSplit
	| CrossingBuilt
	| SquareReserved
	| RailOpened
	| StationOpened
	| AssetPlaced;

/** Inclusive end-of-year or exact event cursor. Event index -1 reads the empty prefix. */
export type CityGrowthCursor =
	Readonly<{ kind: 'year'; year: number }> | Readonly<{ kind: 'event'; index: number }>;

type SnapshotBuilding = Omit<CityGrowthBuilding, 'parts'> &
	Readonly<{
		parts: readonly (CityGrowthPart & Readonly<{ phase: 'addition' | 'retained' }>)[];
	}>;

/** Frozen replay prefix in activation order, with phase resolved for the selected cursor. */
export type CityGrowthSnapshot = Readonly<{
	year: number;
	datumZ: number;
	holdings: readonly CityGrowthHolding[];
	lanes: readonly CityGrowthLane[];
	buildings: readonly SnapshotBuilding[];
	retiredBuildings: readonly (CityGrowthBuilding & Readonly<{ retiredYear: number }>)[];
	crossings: readonly CrossingBuilt[];
	squares: readonly SquareReserved[];
	rail: readonly RailOpened[];
	stations: readonly StationOpened[];
	assets: readonly CityGrowthAsset[];
	events: readonly CityGrowthEvent[];
	eventCount: number;
	lastEvent: CityGrowthEvent | null;
}>;
