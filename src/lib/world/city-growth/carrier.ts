import { distance, readVertexMean, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { AddressedParcel, ParcelPortal } from '../../domain/parcels';
import {
	cityBankSetbackM,
	readCityGrid,
	readCityParcels,
	riverCityRecipe,
	type CityGrid,
	type CitySite,
	type CityTerrainReading
} from '../city-site';
import { readFootprint, readStoreyPlanes, type BuildingGround } from './building';
import { readLaneAccess } from './lanes';
import type { CityGrowthRecipe } from './types';

export type HoldingCandidate = Readonly<{
	parcel: AddressedParcel;
	portal: ParcelPortal;
	memberCellIds: readonly string[];
	ground: BuildingGround;
	siteScore: number;
}>;

function readWater(site: CitySite, { plan, crossings }: CityGrid) {
	const vertices = new Map(plan.vertices.map(({ id, position }) => [id, position]));
	const pointAt = (id: string) => required(vertices.get(id), 'plan vertex');
	const channel = plan.cells.flatMap(({ groundKind, vertexIds }) => {
		if (!groundKind || groundKind === 'dry') return [];
		const point = readVertexMean(vertexIds.map(pointAt));
		const { waterHeight } = site.sampleGround(...point);
		return waterHeight === undefined ? [] : [{ point, waterHeight }];
	});
	const landings = [
		...new Set(crossings.flatMap(({ heads }) => heads.map(({ nodeId }) => nodeId)))
	].map((id): Vec2 => {
		const [x, y] = pointAt(id);
		return [x, y];
	});
	return { channel, landings };
}

function readLocalWaterHeight(
	channel: ReturnType<typeof readWater>['channel'],
	center: Vec2,
	searchRadiusM: number
) {
	let waterHeight: number | undefined;
	let nearestM = searchRadiusM;
	for (const water of channel) {
		const distanceM = distance(center, water.point);
		if (distanceM >= nearestM) continue;
		nearestM = distanceM;
		waterHeight = water.waterHeight;
	}
	return waterHeight;
}

function readShelter(site: CitySite, recipe: CityGrowthRecipe, [x, y]: Vec2, height: number) {
	const { bearing } = site.frame;
	const dx = -Math.sin(bearing) * recipe.shelterProbeDistanceM;
	const dy = Math.cos(bearing) * recipe.shelterProbeDistanceM;
	const a = site.sampleGround(x + dx, y + dy);
	const b = site.sampleGround(x - dx, y - dy);
	const rise = Math.max(
		0,
		a.waterKind === null ? a.height - height : 0,
		b.waterKind === null ? b.height - height : 0
	);
	return 1 - 1 / (1 + rise / recipe.shelterRiseScaleM);
}

function readSiteScore(
	site: CitySite,
	{ channel, landings }: ReturnType<typeof readWater>,
	recipe: CityGrowthRecipe,
	datumZ: number,
	center: Vec2,
	{
		lowest,
		slope,
		reading: { height, waterClearance }
	}: {
		lowest: number;
		slope: number;
		reading: CityTerrainReading;
	}
) {
	const waterHeight = readLocalWaterHeight(channel, center, recipe.waterSearchRadiusM);
	if (waterHeight !== undefined && lowest - waterHeight < recipe.minimumFloodFreeboardM)
		return undefined;
	const rise = height - (waterHeight ?? datumZ);
	const terrace =
		1 / (1 + Math.abs(rise - recipe.preferredTerraceHeightM) / recipe.terraceHeightScaleM);
	const landingDistanceM = landings.reduce(
		(nearest, point) => Math.min(nearest, distance(center, point)),
		Infinity
	);
	const approachM = landings.length ? landingDistanceM : waterClearance;
	const landing = 1 / (1 + approachM / recipe.landingDistanceScaleM);
	const shelter = readShelter(site, recipe, center, height);
	return (
		recipe.terraceWeight * terrace +
		recipe.landingWeight * landing +
		recipe.shelterWeight * shelter -
		recipe.slopeWeight * slope
	);
}

function readCandidate(
	site: CitySite,
	recipe: CityGrowthRecipe,
	water: ReturnType<typeof readWater>,
	datumZ: number,
	parcel: AddressedParcel,
	portal: ParcelPortal,
	memberCellIds: readonly string[]
): HoldingCandidate | undefined {
	if (parcel.publicUse) return undefined;
	const footprint = readFootprint(parcel, portal, recipe.buildingRadiusShare);
	if (!footprint) return undefined;
	const center = readVertexMean(footprint);
	const reading = site.sampleGround(...center);
	const readings = [...parcel.outline, ...footprint].map((point) => site.sampleGround(...point));
	readings.push(reading);
	// The terrain carrier already clips for setback. Recheck water kind at the actual parcel samples.
	if (readings.some(({ height, waterKind }) => !Number.isFinite(height) || waterKind !== null))
		return undefined;
	if (reading.waterClearance < cityBankSetbackM) return undefined;
	const heights = readings.map(({ height }) => height);
	const lowest = Math.min(...heights);
	const slope = (Math.max(...heights) - lowest) / Math.sqrt(parcel.areaM2);
	const siteScore = readSiteScore(site, water, recipe, datumZ, center, { lowest, slope, reading });
	if (siteScore === undefined) return undefined;
	const ground = readings.slice(parcel.outline.length).map(({ height }) => height);
	return {
		parcel,
		portal,
		memberCellIds,
		ground: { footprint, lowest: Math.min(...ground), highest: Math.max(...ground) },
		siteScore
	};
}

export function prepareGrowth(site: CitySite, recipe: CityGrowthRecipe, seed: number) {
	const layout = readCityGrid(site, recipe.carrierSizeM, recipe.planFamily, seed);
	const { parcels, portals, blocks, lanes } = readCityParcels(site, layout);
	const { datumZ } = layout;
	const water = readWater(site, layout);
	const portalsById = new Map(portals.map((portal) => [portal.id, portal]));
	const membersByBlock = new Map(blocks.map(({ id, memberCellIds }) => [id, memberCellIds]));
	const holdingsByLane = new Map<string, HoldingCandidate[]>();
	for (const parcel of parcels) {
		const portal = required(portalsById.get(parcel.portalId), 'holding portal');
		const members = required(membersByBlock.get(parcel.blockId), 'holding block cells');
		const holding = readCandidate(site, recipe, water, datumZ, parcel, portal, members);
		if (!holding) continue;
		const holdings = holdingsByLane.get(portal.laneId) ?? [];
		holdings.push(holding);
		holdingsByLane.set(portal.laneId, holdings);
	}
	const accessByLane = readLaneAccess(
		lanes,
		new Set(holdingsByLane.keys()),
		recipe.maximumLaneHops
	);
	return {
		datumZ,
		planScope: layout.growth.planScope,
		planes: readStoreyPlanes(datumZ, site.recipe ?? riverCityRecipe),
		holdingsByLane,
		accessByLane,
		lanesById: new Map(lanes.map((lane) => [lane.id, lane]))
	};
}

export type GrowthCarrier = ReturnType<typeof prepareGrowth>;
