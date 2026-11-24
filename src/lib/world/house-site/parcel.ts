import { distance, type Vec2 } from '../../core/geometry';
import { Random } from '../../core/random';
import { defaults } from '../../../config/house-site';
import {
	createStripSpace,
	minimumParcelEdgeM,
	parcelEdgeId,
	type ParcelCorner
} from '../../domain/cell-space';
import { levelHeight, storeysPerLevel, type CityColumn } from '../../domain/city-volume';
import {
	createHouseCourt,
	createHouseObject,
	houseStyles,
	type HouseDetail,
	type HouseInputs,
	type HouseStyle
} from '../../domain/house-court';
import type { Parcel, ParcelBlock, ParcelPortal, PlanPolygon } from '../../domain/parcels';
import { readBaseLevel } from './base';

const { contactToleranceM, cornerSineRatio } = defaults;

/** A parcel and its permanent frontage, with the active columns and common city datum.
 * `groundAt` reads the ground elevation in meters at a plan point; without it the lane is taken
 * at the house's base and the entrance needs no steps. */
export type ParcelHouseSite = Readonly<{
	parcel: Parcel;
	portal: ParcelPortal;
	block: ParcelBlock;
	columns: ReadonlyMap<string, CityColumn>;
	datumZ: number;
	linearToleranceM: number;
	groundAt?: (point: Vec2) => number;
}>;

type Segment = readonly [Vec2, Vec2];

function rings(polygons: readonly PlanPolygon[]): Segment[] {
	return polygons.flatMap((polygon) =>
		polygon.flatMap((ring) => ring.map((point, i): Segment => [point, ring[(i + 1) % ring.length]]))
	);
}

function segmentDistance([px, py]: Vec2, [[ax, ay], [bx, by]]: Segment): number {
	const [dx, dy] = [bx - ax, by - ay];
	const length = dx * dx + dy * dy;
	const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Indices of ring edges whose midpoint lies on one of the boundary segments. */
function touching(ring: readonly Vec2[], boundary: readonly Segment[]): number[] {
	return ring.flatMap(([x, y], i) => {
		const [u, v] = ring[(i + 1) % ring.length];
		const mid: Vec2 = [(x + u) / 2, (y + v) / 2];
		return boundary.some((segment) => segmentDistance(mid, segment) <= contactToleranceM)
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

function supportedCorners(outline: readonly Vec2[]) {
	const corners: ParcelCorner[] = [];
	for (const [i, position] of outline.entries()) {
		const previous = corners.at(-1);
		if (!previous || distance(previous.position, position) >= minimumParcelEdgeM)
			corners.push({ id: 'corner/' + i, position });
	}
	while (
		corners.length > 1 &&
		distance(corners[0].position, corners[corners.length - 1].position) < minimumParcelEdgeM
	)
		corners.pop();
	return corners;
}

function frontageIndex(ring: readonly Vec2[], points: readonly Vec2[], tolerance: number) {
	return ring.findIndex(([x, y], i) => {
		const [u, v] = ring[(i + 1) % ring.length];
		const length = Math.hypot(u - x, v - y);
		if (length <= tolerance) return false;
		const dx = (u - x) / length;
		const dy = (v - y) / length;
		return points.every(([a, b]) => {
			const along = (a - x) * dx + (b - y) * dy;
			const across = (b - y) * dx - (a - x) * dy;
			return Math.abs(across) <= tolerance && along >= -tolerance && along <= length + tolerance;
		});
	});
}

/** The first storey plane above the datum at or above the given height. */
// Exact arithmetic: whole storeys from the datum.
function storeyPlane(datumZ: number, storeyHeightM: number, z: number): number {
	return datumZ + Math.ceil((z - datumZ) / storeyHeightM) * storeyHeightM;
}

/** Places one house in an addressed city parcel. Its portal identifies the containing CCW
 * boundary edge. The highest member base and lowest member roof bound the shared vertical
 * space in lattice levels. With `groundAt`, the house stands instead on the first storey plane
 * (half a level) at or above the highest ground of its own parcel, so the entrance rise stays
 * below a storey and houses step with the slope; the lowest member roof still bounds it. The cell space is a strip space (`createStripSpace`) with parcel-local
 * IDs and world-meter coordinates; parcel edges on the block's public court become its court
 * edges, so the house opens onto that court instead of cutting its own. A parcel with another lane
 * edge turned from its frontage is a block corner. The entrance rise is the base above the ground
 * at the portal's middle. The house seed is the input seed derived by the parcel ID, so
 * neighbours draw differently inside one style row. Edges below cell space's minimum collapse while surviving corners keep
 * their original keys. Throws RangeError for a public holding, mismatched frontage, missing
 * members or no shared bay. */
export function createParcelHouse(
	{ parcel, portal, block, columns, datumZ, linearToleranceM, groundAt }: ParcelHouseSite,
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
	const bases = members.map((member) => readBaseLevel(member, datumZ));
	const baseLevel = Math.max(...bases);
	const roofLevel = Math.min(...members.map(({ levels }, i) => bases[i] + levels));
	if (!(roofLevel > baseLevel)) throw new RangeError('The block has no common full bay');

	const corners = supportedCorners(parcel.outline);
	const ring = corners.map(({ position }) => position);
	const tolerance =
		corners.length === parcel.outline.length
			? linearToleranceM
			: Math.max(linearToleranceM, minimumParcelEdgeM);
	const edge = frontageIndex(ring, portal.points, tolerance);
	if (edge < 0) throw new RangeError('The portal does not lie on a parcel edge ' + portal.id);
	const edgeId = (i: number) => parcelEdgeId(corners[i].id, corners[(i + 1) % corners.length].id);
	const storeyHeightM = levelHeight / storeysPerLevel;
	const roofZ = datumZ + roofLevel * levelHeight;
	const baseZ = groundAt
		? storeyPlane(datumZ, storeyHeightM, Math.max(...ring.map(groundAt)))
		: datumZ + baseLevel * levelHeight;
	const space = createStripSpace({
		id: parcel.id,
		corners,
		frontage: [edgeId(edge)],
		courtEdges: touching(ring, rings(block.publicGround.court))
			.filter((i) => i !== edge)
			.map(edgeId),
		baseZ: Math.min(baseZ, roofZ - storeyHeightM),
		storeyCount: Math.max(
			1,
			Math.round((roofZ - Math.min(baseZ, roofZ - storeyHeightM)) / storeyHeightM)
		),
		storeyHeightM
	});
	const groundZ = Math.min(
		...members.flatMap(({ corners }) => corners.map(({ position }) => position[2]))
	);
	const [[ax, ay], [bx, by]] = portal.points;
	const laneZ = Math.min(
		space.baseZ,
		groundAt ? groundAt([(ax + bx) / 2, (ay + by) / 2]) : space.baseZ
	);
	const lowest = Math.min(groundZ, laneZ);
	const site = {
		entranceRiseM: space.baseZ - laneZ,
		corner: isCorner(ring, edge, block),
		groundZ: lowest
	};
	return Object.freeze({
		parcel,
		portal,
		style,
		space,
		house: createHouseCourt(
			space,
			{ ...inputs, seed: Random.create({ seed: inputs.seed }).derive(parcel.id).seed },
			style,
			site
		),
		baseLevel,
		groundZ: lowest,
		laneZ
	});
}

/** Builds a placed house. Its ground plates reach down to the lowest ground under the block as a
 * plinth, and the entrance steps stand on that ground. */
export function createParcelHouseObject(
	{ style, space, house }: ReturnType<typeof createParcelHouse>,
	detail: HouseDetail
) {
	return createHouseObject(space, house, detail, style);
}
