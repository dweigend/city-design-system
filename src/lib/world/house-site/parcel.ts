import { distance, measurePointSegmentDistance, type Vec2 } from '../../core/geometry';
import type { Catalog } from '../../core/catalog';
import { Random } from '../../core/random';
import { defaults } from '../../../config/house-site';
import {
	createCellSpaceStoreys,
	createSubgridSpace,
	type CellSubgridGenerator,
	type CellSubgridOptions,
	minimumParcelEdgeM,
	parcelEdgeId,
	type ParcelCorner
} from '../../domain/cell-space';
import type { CityColumn } from '../../domain/city-volume';
import {
	createHouseCourt,
	createHouseObject,
	houseStyles,
	houseScale,
	type AdjoiningWall,
	type HouseDetail,
	type HouseInputs,
	type HouseSite,
	type HouseStyle,
	type HouseScale
} from '../../domain/house-court';
import type { AddressedParcel, ParcelBlock, ParcelPortal, PlanPolygon } from '../../domain/parcels';
import {
	createCityVerticalRecipe,
	riverCityRecipe,
	type CityVerticalRecipeInput
} from '../city-site';
import { createParcelStoreySizing } from './vertical';
import { readBaseLevel } from './base';
import { parcelGroundRange } from './parcel-ground';

const { contactToleranceM, cornerSineRatio } = defaults;

/** Selects vertical sizing and the plan subdivision of a parcel house. */
export type ParcelHouseRecipe = Readonly<{
	vertical?: CityVerticalRecipeInput;
	subgridId?: string;
	subgridOptions?: CellSubgridOptions;
	subgridCatalog?: Catalog<CellSubgridGenerator>;
	/** Selects occupied uses and phases using the parcel's common bay as a program anchor. */
	storeyProgram?: (
		parcelId: string,
		baseDatumIndex: number
	) => NonNullable<HouseSite['storeyProgram']>;
}>;

/** A parcel and its permanent frontage, with the active columns and common city datum.
 * `groundAt` reads the ground elevation in meters at a plan point; without it the lane is taken
 * at the house's base and the entrance needs no steps. */
export type ParcelHouseSite = Readonly<{
	parcel: AddressedParcel;
	portal: ParcelPortal;
	block: ParcelBlock;
	columns: ReadonlyMap<string, CityColumn>;
	datumZ: number;
	linearToleranceM: number;
	groundAt?: (point: Vec2) => number;
	scale?: HouseScale | 'by-area';
	recipe?: ParcelHouseRecipe;
}>;

type Segment = readonly [Vec2, Vec2];

function rings(polygons: readonly PlanPolygon[]): Segment[] {
	return polygons.flatMap((polygon) =>
		polygon.flatMap((ring) => ring.map((point, i): Segment => [point, ring[(i + 1) % ring.length]]))
	);
}

/** Indices of ring edges whose midpoint lies on one of the boundary segments. */
function touching(ring: readonly Vec2[], boundary: readonly Segment[]): number[] {
	return ring.flatMap(([x, y], i) => {
		const [u, v] = ring[(i + 1) % ring.length];
		const mid: Vec2 = [(x + u) / 2, (y + v) / 2];
		return boundary.some(
			(segment) => measurePointSegmentDistance(mid, ...segment) <= contactToleranceM
		)
			? [i]
			: [];
	});
}

function direction(ring: readonly Vec2[], i: number): Vec2 {
	const [[x, y], [u, v]] = [ring[i], ring[(i + 1) % ring.length]];
	const length = Math.hypot(u - x, v - y);
	return [(u - x) / length, (v - y) / length];
}

/** True when another lane edge of the parcel turns away from the frontage: a block corner. */
function isCorner(ring: readonly Vec2[], frontage: number, block: ParcelBlock): boolean {
	const [fx, fy] = direction(ring, frontage);
	return touching(ring, rings(block.netGround)).some((i) => {
		const [dx, dy] = direction(ring, i);
		return i !== frontage && Math.abs(fx * dy - fy * dx) > cornerSineRatio;
	});
}

function frontageCorners(parcel: AddressedParcel, [from, to]: ParcelPortal['side']) {
	const start = parcel.corners.findIndex(({ id }) => id === from);
	if (start < 0 || parcel.corners[(start + 1) % parcel.corners.length].id !== to)
		throw new RangeError('The portal does not address a parcel side ' + parcel.portalId);
	const ordered = [...parcel.corners.slice(start), ...parcel.corners.slice(0, start)];
	const corners: ParcelCorner[] = [];
	for (const corner of ordered) {
		const previous = corners.at(-1);
		if (!previous || distance(previous.position, corner.position) >= minimumParcelEdgeM)
			corners.push(corner);
	}
	while (
		corners.length > 1 &&
		distance(corners[0].position, corners[corners.length - 1].position) < minimumParcelEdgeM
	)
		corners.pop();
	return corners;
}

/** Places one seeded house in an addressed private parcel. The portal identifies its CCW
 * frontage edge and the block's court tags identify the sides that open onto a shared court.
 * The highest common base and lowest roof of the member bays define the vertical range.
 * When given, `groundAt` samples the parcel footprint for the plinth and the chosen entrance
 * midpoint for access. `scale` defaults to regular. The town requests area-based scale.
 * A parcel that cannot take a house returns `unbuildable` with its reason, leaving the ground
 * available as garden. Throws for a public holding, mismatched frontage or missing members. */
export function createParcelHouse(
	{ parcel, portal, block, columns, datumZ, groundAt, scale, recipe }: ParcelHouseSite,
	inputs: HouseInputs,
	style: HouseStyle = houseStyles.neutral
) {
	if (parcel.publicUse) throw new RangeError('A public holding cannot take a house');
	if (parcel.blockId !== block.id || portal.parcelId !== parcel.id || portal.id !== parcel.portalId)
		throw new RangeError('Parcel, block and portal must belong to the same holding');
	const members = block.memberCellIds.map((id) => {
		const column = columns.get(id);
		if (!column) throw new RangeError('Missing house block member ' + id);
		return column;
	});
	const vertical = recipe?.vertical ? createCityVerticalRecipe(recipe.vertical) : riverCityRecipe;
	const { levelHeightM } = vertical;
	const bases = members.map((member) => readBaseLevel(member, datumZ, levelHeightM));
	const baseLevel = Math.max(...bases);
	const roofLevel = Math.min(...members.map(({ levels }, i) => bases[i] + levels));
	if (!(roofLevel > baseLevel))
		return Object.freeze({
			status: 'unbuildable',
			reason: 'no-common-bay',
			parcel,
			portal
		} as const);

	const corners = frontageCorners(parcel, portal.side);
	const ring = corners.map(({ position }) => position);
	// Exact arithmetic: the ring starts with the directed frontage.
	const edge = /* Exact arithmetic: first parcel side is the entrance edge. */ 0;
	const edgeId = (i: number) => parcelEdgeId(corners[i].id, corners[(i + 1) % corners.length].id);
	const sizing = createParcelStoreySizing(vertical, datumZ, baseLevel, roofLevel);
	const bay = createSubgridSpace(
		{
			id: parcel.id,
			corners,
			frontage: [edgeId(edge)],
			courtEdges: touching(ring, rings(block.publicGround.court))
				.filter((i) => i !== edge)
				.map(edgeId),
			...sizing
		},
		recipe?.subgridId ?? 'frontage-strip',
		recipe?.subgridOptions,
		recipe?.subgridCatalog
	);
	const terrain = groundAt
		? parcelGroundRange(bay, parcel.outline, groundAt)
		: {
				low: Math.min(
					...members.flatMap(({ corners }) => corners.map(({ position }) => position[2]))
				),
				high: sizing.baseZ
			};
	const space = groundAt
		? createCellSpaceStoreys(
				bay,
				createParcelStoreySizing(vertical, datumZ, baseLevel, roofLevel, terrain.high)
			)
		: bay;
	const house = createHouseCourt(
		space,
		{ ...inputs, seed: Random.create({ seed: inputs.seed }).derive(parcel.id).seed },
		style,
		{
			groundAtEntrance: groundAt,
			corner: isCorner(ring, edge, block),
			groundZ: terrain.low,
			scale: scale === 'by-area' ? houseScale(space) : scale,
			storeyProgram: recipe?.storeyProgram?.(parcel.id, sizing.datumIndex ?? 0)
		}
	);
	if (house.unbuildable)
		return Object.freeze({
			status: 'unbuildable',
			reason: house.unbuildable,
			parcel,
			portal
		} as const);
	return Object.freeze({
		status: 'placed',
		parcel,
		portal,
		style,
		space,
		house,
		baseLevel,
		groundZ: house.site.groundZ ?? terrain.low,
		laneZ: house.site.laneZ ?? space.baseZ
	} as const);
}

/** A city parcel's occupied house or named reason why it remains garden. */
export type ParcelHouseResult = ReturnType<typeof createParcelHouse>;

/** A private parcel house that fitted its frontage, ground and bay. */
export type PlacedParcelHouse = Extract<ParcelHouseResult, { status: 'placed' }>;

/** Builds a placed house. Its ground plates reach down to the lowest sampled ground under the parcel as a
 * plinth, and the entrance steps stand on that ground. Adjoining walls suppress openings. */
export function createParcelHouseObject(
	{ style, space, house }: PlacedParcelHouse,
	detail: HouseDetail,
	adjoiningWalls: readonly AdjoiningWall[] = []
) {
	return createHouseObject(space, house, detail, style, adjoiningWalls);
}
