import { distance, readVertexMean, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { readCityColumns } from '../../domain/city-volume';
import type { AddressedParcel, ParcelPortal } from '../../domain/parcels';
import {
	cityBankSetbackM,
	readCityDistricts,
	readCityGrid,
	readCityParcels,
	riverCityRecipe,
	type CityGrid,
	type CitySite,
	type CityTerrainReading
} from '../city-site';
import { createTownParcelSites } from '../house-site';
import { prepareBurgage, type Burgage } from './burgage';
import { readFootprint, readStoreyPlanes, type BuildingGround } from './building';
import { readLaneAccess } from './lanes';
import { prepareInfrastructure } from './infrastructure';
import { readEra } from './recipe';
import type { CityGrowthRecipe } from './types';

export type HoldingCandidate = Readonly<{
	parcel: AddressedParcel;
	portal: ParcelPortal;
	memberCellIds: readonly string[];
	ground: BuildingGround;
	minimumGroundZ: number;
	siteScore: number;
	anchor: readonly [number, number, number];
	outlineElevationsM?: readonly number[];
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

const waterProbeAngles = Array.from(
	{ length: /* Exact arithmetic: eight compass directions around a candidate. */ 8 },
	(_, index) => (index * Math.PI) / /* Exact arithmetic: eighths of a turn. */ 4
);

function probeNearbyWaterHeight(
	site: CitySite,
	[x, y]: Vec2,
	waterClearance: number,
	searchRadiusM: number
) {
	if (!(waterClearance < searchRadiusM)) return undefined;
	const clearance = Math.max(0, waterClearance);
	const radii = [
		clearance + /* Exact arithmetic: step past the bank into a narrow channel. */ 2,
		clearance + /* Exact arithmetic: mid-channel sample for narrow streams. */ 8,
		(clearance + searchRadiusM) / 2,
		searchRadiusM
	].filter((radius) => radius <= searchRadiusM);
	let waterHeight: number | undefined;
	let nearestM = searchRadiusM;
	for (const radius of radii) {
		for (const angle of waterProbeAngles) {
			const reading = site.sampleGround(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
			if (reading.waterHeight === undefined || !Number.isFinite(reading.waterHeight)) continue;
			if (radius >= nearestM) continue;
			nearestM = radius;
			waterHeight = reading.waterHeight;
		}
		if (waterHeight !== undefined) return waterHeight;
	}
	return undefined;
}

function readLocalWaterHeight(
	site: CitySite,
	channel: ReturnType<typeof readWater>['channel'],
	center: Vec2,
	waterClearance: number,
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
	return waterHeight ?? probeNearbyWaterHeight(site, center, waterClearance, searchRadiusM);
}

function readShelter(site: CitySite, recipe: CityGrowthRecipe, [x, y]: Vec2, height: number) {
	const { bearing } = site.frame;
	const dx = -Math.sin(bearing) * recipe.shelterProbeDistanceM;
	const dy = Math.cos(bearing) * recipe.shelterProbeDistanceM;
	const a = site.sampleGround(x + dx, y + dy);
	const b = site.sampleGround(x - dx, y - dy);
	const rise = Math.max(
		0,
		a.waterKind === null && Number.isFinite(a.height) ? a.height - height : 0,
		b.waterKind === null && Number.isFinite(b.height) ? b.height - height : 0
	);
	return 1 - 1 / (1 + rise / recipe.shelterRiseScaleM);
}

function readSiteScore(
	site: CitySite,
	landings: readonly Vec2[],
	waterHeight: number | undefined,
	recipe: CityGrowthRecipe,
	datumZ: number,
	center: Vec2,
	{
		slope,
		reading: { height, waterClearance }
	}: {
		slope: number;
		reading: CityTerrainReading;
	}
) {
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
	if (!(reading.waterClearance >= cityBankSetbackM)) return undefined;
	const heights = readings.map(({ height }) => height);
	const lowest = Math.min(...heights);
	const slope = (Math.max(...heights) - lowest) / Math.sqrt(parcel.areaM2);
	const waterHeight = readLocalWaterHeight(
		site,
		water.channel,
		center,
		reading.waterClearance,
		recipe.waterSearchRadiusM
	);
	const minimumGroundZ = (waterHeight ?? -Infinity) + recipe.minimumFloodFreeboardM;
	if (lowest < minimumGroundZ) return undefined;
	const siteScore = readSiteScore(site, water.landings, waterHeight, recipe, datumZ, center, {
		slope,
		reading
	});
	const ground = readings.slice(parcel.outline.length).map(({ height }) => height);
	return {
		parcel,
		portal,
		memberCellIds,
		ground: { footprint, lowest: Math.min(...ground), highest: Math.max(...ground) },
		minimumGroundZ,
		siteScore,
		anchor: Object.freeze([center[0], center[1], reading.height] as const),
		...(recipe.development && { outlineElevationsM: heights.slice(0, parcel.outline.length) })
	};
}

function readCellGround(site: CitySite, ring: readonly Vec2[], minimumGroundZ: number) {
	const samples = [...ring, readVertexMean(ring)].map((point) => site.sampleGround(...point));
	if (
		samples.some(
			({ height, waterKind }) =>
				!Number.isFinite(height) || waterKind !== null || height < minimumGroundZ
		)
	)
		return undefined;
	const heights = samples.map(({ height }) => height);
	return { lowest: Math.min(...heights), highest: Math.max(...heights) };
}

export function prepareGrowth(site: CitySite, recipe: CityGrowthRecipe, seed: number) {
	const layout = readCityGrid(site, recipe.carrierSizeM, recipe.planFamily, seed);
	const parcelPlan = readCityParcels(site, layout);
	const { parcels, portals, blocks, lanes, linearToleranceM } = parcelPlan;
	const columns = new Map(
		readCityColumns(layout.grid, readCityDistricts(site, layout, seed)).map((column) => [
			column.planCellId,
			column
		])
	);
	const { datumZ } = layout;
	const vertical = site.recipe ?? riverCityRecipe;
	const planes = readStoreyPlanes(datumZ, vertical);
	const parcelSites = createTownParcelSites(
		parcelPlan,
		columns,
		datumZ,
		([x, y]) => site.sampleGround(x, y).height,
		site.recipe ? { vertical: site.recipe } : undefined
	);
	const foundingEra = readEra(recipe, recipe.startYear);
	const initialHeightM =
		planes.atIndex(recipe.initialStoreys) -
		planes.atIndex(/* Exact arithmetic: measure initial height from datum index zero. */ 0);
	const water = readWater(site, layout);
	const portalsById = new Map(portals.map((portal) => [portal.id, portal]));
	const membersByBlock = new Map(blocks.map(({ id, memberCellIds }) => [id, memberCellIds]));
	const holdingsByLane = new Map<string, HoldingCandidate[]>();
	const minimumGroundByParcel = new Map<string, number>();
	for (const parcel of parcels) {
		const portal = required(portalsById.get(parcel.portalId), 'holding portal');
		const members = required(membersByBlock.get(parcel.blockId), 'holding block cells');
		const holding = readCandidate(site, recipe, water, datumZ, parcel, portal, members);
		if (!holding) continue;
		minimumGroundByParcel.set(parcel.id, holding.minimumGroundZ);
		const holdings = holdingsByLane.get(portal.laneId) ?? [];
		holdings.push(holding);
		holdingsByLane.set(portal.laneId, holdings);
	}
	const burgages = new Map<string, Burgage | undefined>();
	function readBurgage(parcelId: string): Burgage | undefined {
		if (burgages.has(parcelId)) return burgages.get(parcelId);
		const minimumGroundZ = minimumGroundByParcel.get(parcelId);
		const parcelSite = minimumGroundZ === undefined ? undefined : parcelSites(parcelId);
		const burgage =
			parcelSite === undefined || minimumGroundZ === undefined
				? undefined
				: prepareBurgage(parcelSite, foundingEra, initialHeightM, seed, (ring) =>
						readCellGround(site, ring, minimumGroundZ)
					);
		burgages.set(parcelId, burgage);
		return burgage;
	}
	// Mutable caller samplers must be captured completely before advanceCityGrowth runs.
	if (site.terrainRevision) {
		for (const parcelId of minimumGroundByParcel.keys()) readBurgage(parcelId);
	}
	const accessByLane = readLaneAccess(
		lanes,
		new Set(holdingsByLane.keys()),
		recipe.maximumLaneHops
	);
	return {
		site,
		terrainRevision: JSON.stringify(site.terrainRevision?.()),
		layout,
		parcelPlan,
		columns,
		neighborsByCell: new Map(layout.grid.cells.map(({ id, neighbors }) => [id, neighbors])),
		infrastructure: recipe.development
			? prepareInfrastructure(
					site,
					layout,
					[...columns.values()],
					lanes,
					recipe.development,
					recipe.endYear
				)
			: undefined,
		datumZ,
		linearToleranceM,
		readBurgage,
		planScope: layout.growth.planScope,
		planes,
		holdingsByLane,
		accessByLane,
		lanesById: new Map(lanes.map((lane) => [lane.id, lane]))
	};
}

export type GrowthCarrier = ReturnType<typeof prepareGrowth>;
