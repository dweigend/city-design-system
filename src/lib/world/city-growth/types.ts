import type { Vec2 } from '../../core/geometry';
import type { HouseStyleName } from '../../domain/house-court';
import type { StoreyProgram } from '../../domain/massing';
import type { Part } from '../../core/object';
import type { AddressedParcel, ParcelLane, ParcelPortal } from '../../domain/parcels';
import type { CityPlanVariant } from '../city-site';

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

type EventDate = Readonly<{ year: number; sequence: number }>;

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
	| HoldingSplit;

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
	events: readonly CityGrowthEvent[];
	eventCount: number;
	lastEvent: CityGrowthEvent | null;
}>;
