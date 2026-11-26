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
}>;

/** The entire addressed parcel, its frontage portal and its original source cells. */
export type CityGrowthHolding = AddressedParcel &
	Readonly<{ portal: ParcelPortal; memberCellIds: readonly string[]; builtYear: number }>;

/** A public lane interval dated at its first use by the settlement. */
export type CityGrowthLane = ParcelLane & Readonly<{ builtYear: number }>;

/** Dated geometry with a stable floor address relative to the common vertical datum. */
export type CityGrowthPart = Part &
	Readonly<{ kind: 'foundation' | 'storey'; datumIndex: number; builtYear: number }>;

/** A dated building anchored to its holding, with parts listed from the ground up. */
export type CityGrowthBuilding = Readonly<{
	id: string;
	holdingId: string;
	builtYear: number;
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

/** A dated transaction, ordered by calendar year and zero-based sequence within that year. */
export type CityGrowthEvent = HoldingSettled;

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
	events: readonly CityGrowthEvent[];
	eventCount: number;
	lastEvent: CityGrowthEvent | null;
}>;
