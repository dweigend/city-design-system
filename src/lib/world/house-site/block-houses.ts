import { defaults } from '../../../config/house-site';
import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import {
	houseFaces,
	type AdjoiningWall,
	type HouseFace,
	type HouseStyle
} from '../../domain/house-court';
import type { HouseInputs } from '../../domain/massing';
import type { ParcelBlock } from '../../domain/parcels';
import { createParcelHouse, type PlacedParcelHouse } from './parcel';
import type { createTownHouseStudy } from './parcel-town';

const { contactToleranceM } = defaults;

function onEdge([x, y]: Vec2, [ax, ay]: Vec2, [bx, by]: Vec2) {
	const [dx, dy] = [bx - ax, by - ay];
	const length = Math.hypot(dx, dy);
	const across = ((x - ax) * dy - (y - ay) * dx) / length;
	const along = ((x - ax) * dx + (y - ay) * dy) / length;
	return (
		Math.abs(across) <= contactToleranceM &&
		along >= -contactToleranceM &&
		along <= length + contactToleranceM
	);
}

function boundaryWall(face: HouseFace, outline: readonly Vec2[]): AdjoiningWall[] {
	if (face.place !== 'wall') return [];
	const {
		origin: [x, y, bottom],
		across: [dx, dy],
		size: [width, height]
	} = face;
	const a: Vec2 = [x, y];
	const b: Vec2 = [x + dx * width, y + dy * width];
	const onBoundary = outline.some((start, i) => {
		const end = outline[(i + 1) % outline.length];
		return onEdge(a, start, end) && onEdge(b, start, end);
	});
	return onBoundary ? [{ a, b, bottom, top: bottom + height }] : [];
}

/** Reads the occupied wall spans that lie on the parcel contour, in world meters.
 * These unoccluded spans serve as inputs to neighbouring houses' skin derivation. */
export function readParcelHouseWalls({
	space,
	house,
	style,
	parcel
}: PlacedParcelHouse): AdjoiningWall[] {
	return houseFaces(space, house, 'full', style).flatMap((face) =>
		boundaryWall(face, parcel.outline)
	);
}

/** Plans occupancy for the private parcels in a town block. Unbuildable parcels stay garden. */
export function placeTownBlockHouses(
	town: Pick<ReturnType<typeof createTownHouseStudy>, 'parcelsByBlock' | 'readParcelSite'>,
	block: ParcelBlock,
	inputs: HouseInputs,
	style: HouseStyle
) {
	const { parcelsByBlock, readParcelSite } = town;
	const results = (parcelsByBlock.get(block.id) ?? [])
		.filter(({ publicUse }) => !publicUse)
		.map((parcel) =>
			createParcelHouse(required(readParcelSite(parcel.id), 'house parcel site'), inputs, style)
		);
	return {
		placed: results.filter((result) => result.status === 'placed'),
		unbuildable: results.filter((result) => result.status === 'unbuildable')
	};
}

/** Places the private parcels of one town block using area-based scale. Each placed house is
 * paired with the occupied boundary walls of the other houses for face and opening derivation.
 * Unbuildable parcels retain their IDs and reasons, and stay garden. */
export function createTownBlockHouses(...args: Parameters<typeof placeTownBlockHouses>) {
	const { placed, unbuildable } = placeTownBlockHouses(...args);
	const walls = placed.length > 1 ? placed.map(readParcelHouseWalls) : [];
	return {
		placed: placed.map((house, i) => ({
			...house,
			adjoiningWalls: adjoiningWalls(walls, i)
		})),
		unbuildable
	};
}

function adjoiningWalls(walls: readonly AdjoiningWall[][], own: number) {
	const adjoining: AdjoiningWall[] = [];
	for (let i = 0; i < walls.length; i++) {
		if (i === own) continue;
		for (const wall of walls[i]) adjoining.push(wall);
	}
	return adjoining;
}
