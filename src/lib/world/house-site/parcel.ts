import { distance, type Vec2 } from '../../core/geometry';
import { PlaceableObject } from '../../core/object';
import {
	createCellSpace,
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
import type { Parcel, ParcelBlock, ParcelPortal } from '../../domain/parcels';
import { readBaseLevel } from './base';

/** A parcel and its permanent frontage, with the active columns and common city datum. */
export type ParcelHouseSite = Readonly<{
	parcel: Parcel;
	portal: ParcelPortal;
	block: ParcelBlock;
	columns: ReadonlyMap<string, CityColumn>;
	datumZ: number;
	linearToleranceM: number;
}>;

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

/** Places one house in an addressed city parcel. Its portal identifies the containing CCW
 * boundary edge. The highest member base and lowest member roof bound the shared vertical
 * space in lattice levels. The cell space uses parcel-local IDs and world-meter coordinates.
 * Edges below cell space's minimum collapse while surviving corners keep their original keys.
 * Throws RangeError for a public holding, mismatched frontage, missing members or no shared bay. */
export function createParcelHouse(
	{ parcel, portal, block, columns, datumZ, linearToleranceM }: ParcelHouseSite,
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
	const tolerance =
		corners.length === parcel.outline.length
			? linearToleranceM
			: Math.max(linearToleranceM, minimumParcelEdgeM);
	const edge = frontageIndex(
		corners.map(({ position }) => position),
		portal.points,
		tolerance
	);
	if (edge < 0) throw new RangeError('The portal does not lie on a parcel edge ' + portal.id);
	const space = createCellSpace({
		id: parcel.id,
		corners,
		frontage: [parcelEdgeId(corners[edge].id, corners[(edge + 1) % corners.length].id)],
		baseZ: datumZ + baseLevel * levelHeight,
		storeyCount: (roofLevel - baseLevel) * storeysPerLevel,
		storeyHeightM: levelHeight / storeysPerLevel
	});
	const groundZ = Math.min(
		...members.flatMap(({ corners }) => corners.map(({ position }) => position[2]))
	);
	return Object.freeze({
		parcel,
		portal,
		style,
		space,
		house: createHouseCourt(space, inputs, style),
		baseLevel,
		groundZ
	});
}

/** Builds a placed house with a plain parcel plinth from its coarse corner ground range to
 * the road-facing plot plates. The house's occupancy and its original parts stay intact. */
export function createParcelHouseObject(
	{ parcel, style, space, house, groundZ }: ReturnType<typeof createParcelHouse>,
	detail: HouseDetail
) {
	const object = createHouseObject(space, house, detail, style);
	const seat = object.parts.find(({ slot, shape }) => slot === 'plot' && shape.kind === 'prism');
	if (seat?.shape.kind !== 'prism' || groundZ >= seat.shape.base) return object;
	return PlaceableObject.create({
		...object,
		parts: [
			{
				id: `${parcel.id}/plinth`,
				slot: 'plot',
				shape: { kind: 'prism', polygon: parcel.outline, base: groundZ, top: seat.shape.base }
			},
			...object.parts
		]
	});
}
