import { defaults } from '../../../config/house-site';
import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import {
	houseFaces,
	type AdjoiningWall,
	type HouseFace,
	type HouseInputs,
	type HouseStyle
} from '../../domain/house-court';
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

function wallsOf({ space, house, style, parcel }: PlacedParcelHouse): AdjoiningWall[] {
	return houseFaces(space, house, 'full', style).flatMap((face) =>
		boundaryWall(face, parcel.outline)
	);
}

/** Places the private parcels of one town block using area-based scale. Each placed house is
 * paired with the occupied boundary walls of the other houses for face and opening derivation.
 * Unbuildable parcels retain their IDs and reasons, and stay garden. */
export function createTownBlockHouses(
	town: ReturnType<typeof createTownHouseStudy>,
	block: ParcelBlock,
	inputs: HouseInputs,
	style: HouseStyle
) {
	const { parcelsByBlock, portals, columns, layout, holdings, groundAt } = town;
	const results = (parcelsByBlock.get(block.id) ?? [])
		.filter(({ publicUse }) => !publicUse)
		.map((parcel) =>
			createParcelHouse(
				{
					parcel,
					portal: required(portals.get(parcel.portalId), 'house frontage'),
					block,
					columns,
					datumZ: layout.datumZ,
					linearToleranceM: holdings.linearToleranceM,
					groundAt,
					scale: 'by-area'
				},
				inputs,
				style
			)
		);
	const built = results.filter((result) => result.status === 'placed');
	const walls = built.map(wallsOf);
	return {
		placed: built.map((house, i) => ({
			...house,
			adjoiningWalls: walls.flatMap((group, j) => (i === j ? [] : group))
		})),
		unbuildable: results.filter((result) => result.status === 'unbuildable')
	};
}
