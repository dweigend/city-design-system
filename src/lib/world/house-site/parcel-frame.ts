import {
	convexHull,
	isConvexCounterclockwise,
	isSimpleRing,
	type Bounds3,
	type Vec2
} from '../../core/geometry';
import { bounds, type Shape } from '../../core/object';
import { encodeKey } from '../../core/ref';
import { readFrameObstructions } from './frame-obstructions';
import { createHouseAssembly, houseFaces, type HouseFace } from '../../domain/house-court';
import {
	createSupportedFrame,
	type FrameObstruction,
	type FrameRejection,
	type FrameRoofSeat,
	type SupportedFrame,
	type SupportedFrameSpec
} from '../../domain/structure';
import type { PlacedParcelHouse } from './parcel';

export type ParcelFrameSpec = Omit<SupportedFrameSpec, 'roofs' | 'obstructions'> &
	Readonly<{ houses: readonly PlacedParcelHouse[] }>;

// Addressed house bodies are storey extrusions. Read the common plan from both contact planes.
function readContactRings(shape: Shape, { min, max }: Bounds3): readonly (readonly Vec2[])[] {
	const valid = (ring: readonly Vec2[]) => isSimpleRing(ring) && isConvexCounterclockwise(ring);
	if (shape.kind === 'prism') return valid(shape.polygon) ? [shape.polygon] : [];
	if (shape.kind !== 'mesh') return [];
	const xy = new Map<number, Vec2[]>([
		[min[2], []],
		[max[2], []]
	]);
	const { positions } = shape;
	// Exact arithmetic: triples of XYZ coordinates in the indexed mesh.
	for (let i = 0; i < positions.length; i += 3)
		xy.get(positions[i + 2])?.push([positions[i], positions[i + 1]]);
	const rings = [...xy.values()].map(convexHull);
	return rings.every(valid) ? rings : [];
}

function roofOutline({ origin: [x, y], across: [ax, ay], outline }: HouseFace): Vec2[] {
	return (outline ?? []).map(([u, v]) => [x + ax * u - ay * v, y + ay * u + ax * v]);
}

function readParcelFrameStock({ parcel, space, house, style }: PlacedParcelHouse) {
	const { object, addresses } = createHouseAssembly(space, house, 'full', style, [], true);
	const byPart = new Map(addresses.map((address) => [address.partId, address]));
	const bodies = new Map<string, Map<number, readonly (readonly Vec2[])[]>>();
	const plates = new Map<string, { id: string; z: number; outline: readonly Vec2[] }[]>();
	const obstructions = object.parts.flatMap((part): readonly FrameObstruction[] => {
		const box = bounds({ ...object, parts: [part] });
		const address = byPart.get(part.id);
		const obstruction = readFrameObstructions(part.shape, box);
		if (!address?.cellId) return obstruction;
		const {
			cellId,
			storeySpan: [from, to],
			body
		} = address;
		const { shape } = part;
		if (body && to === from + 1 && box.min[2] < box.max[2]) {
			let storeys = bodies.get(cellId);
			if (!storeys) {
				storeys = new Map<number, readonly (readonly Vec2[])[]>();
				bodies.set(cellId, storeys);
			}
			const rings = readContactRings(shape, box);
			if (rings.length) storeys.set(from, rings);
		}
		if (
			part.slot === 'plot' &&
			shape.kind === 'prism' &&
			isSimpleRing(shape.polygon) &&
			isConvexCounterclockwise(shape.polygon)
		) {
			const existing = plates.get(cellId) ?? [];
			existing.push({ id: part.id, z: shape.base, outline: shape.polygon });
			plates.set(cellId, existing);
		}
		return obstruction;
	});

	const roofs = houseFaces(space, house, 'full', style, [], true).flatMap(
		(face): FrameRoofSeat[] => {
			if (face.place !== 'roof' || face.normal[2] !== 1 || !face.outline) return [];
			const address = byPart.get(face.body);
			if (!address?.cellId || !address.body) return [];
			const {
				cellId,
				storeySpan: [, end]
			} = address;
			const storeys = bodies.get(cellId);
			if (!storeys) return [];
			const rings: (readonly Vec2[])[] = [];
			for (let level = space.datumIndex; level < end; level++) {
				const contacts = storeys.get(level);
				if (!contacts) return [];
				rings.push(...contacts);
			}
			const outline = roofOutline(face);
			if (!isSimpleRing(outline) || !isConvexCounterclockwise(outline)) return [];
			return (plates.get(cellId) ?? []).map((plate) => ({
				id: encodeKey([face.body, plate.id]),
				hostId: parcel.id,
				outline,
				roofZ: face.origin[2],
				foundationZ: plate.z,
				bearingOutlines: [...rings, plate.outline]
			}));
		}
	);
	return { roofs, obstructions };
}

/** Builds a spanning frame in world meters using the placed parcels as stock.
 * Horizontal roof pads need a continuous column of addressed house bodies and a plinth
 * below them. House parts supply conservative clearance volumes. The supplied terrain sampler
 * also checks stock grounding and founds any allowed piers. No placement is mutated.
 * Returns a detached frame or a typed rejection. Invalid input throws RangeError. */
export function createParcelHouseFrame({
	houses,
	...spec
}: ParcelFrameSpec): SupportedFrame | FrameRejection {
	if (new Set(houses.map(({ parcel }) => parcel.id)).size !== houses.length)
		throw new RangeError('Duplicate parcel in frame stock');
	const stock = houses.map(readParcelFrameStock);
	return createSupportedFrame({
		...spec,
		roofs: stock.flatMap(({ roofs }) => roofs),
		obstructions: stock.flatMap(({ obstructions }) => obstructions)
	});
}
