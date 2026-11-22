import type { BlockInputs } from '../../data/block-inputs';
import type { CellFace, CellSpace } from '../cell-space';
import type { ParcelCells } from '../parcel-deck';
import {
	createOccupancy,
	occupyCells,
	type CellWrite,
	type Occupancy,
	type Reservations
} from '../occupancy';

type RoomRole = 'left' | 'right' | 'rear';
type Room = Readonly<{ id: string; role: RoomRole; cellIds: readonly string[] }>;
type Court = Readonly<{ id: string; cellIds: readonly string[]; exitFaceId: string }>;

export type HouseCourt = Readonly<{
	id: string;
	space: CellSpace;
	inputs: BlockInputs;
	occupancy: Occupancy;
	reservations: Reservations;
	rooms: readonly Room[];
	court: Court;
}>;

const layout = [
	['left', 'court', 'right'],
	['left', 'court', 'right'],
	['rear', 'rear', 'rear']
] as const;

function groups(parcel: ParcelCells) {
	const slots = [...parcel.slots].sort((a, b) => a.row - b.row || a.column - b.column);
	const positions = new Set(slots.map(({ row, column }) => 3 * row + column));
	const cells = new Set(slots.map(({ cellId }) => cellId));
	const available = new Set(parcel.space.cells.map(({ id }) => id));
	if (
		slots.length !== 9 ||
		positions.size !== 9 ||
		cells.size !== 9 ||
		slots.some(({ row, column, cellId }) => !layout[row]?.[column] || !available.has(cellId))
	)
		throw new RangeError('Expected nine distinct, addressed parcel slots');
	const byRole = {
		left: [] as string[],
		right: [] as string[],
		rear: [] as string[],
		court: [] as string[]
	};
	for (const { row, column, cellId } of slots) byRole[layout[row][column]].push(cellId);
	return byRole;
}

function requireConnectivity(space: CellSpace, cellIds: readonly string[]) {
	const connected = new Set([cellIds[0]]);
	for (const id of connected) {
		for (const { uses } of space.faces) {
			if (uses.length !== 2 || !uses.some(({ cellId }) => cellId === id)) continue;
			for (const { cellId } of uses) if (cellIds.includes(cellId)) connected.add(cellId);
		}
	}
	if (connected.size !== cellIds.length) throw new RangeError('Disconnected parcel group');
}

/**
 * Occupies the seven house slots and reserves the existing two-cell court.
 * Entrance-facing slots are row zero. A parcel supplies resolved block inputs and geometry.
 * Omitted fills start empty. No random draws.
 * Returns detached fills and reservations, sharing the supplied cell space and block inputs.
 * Throws RangeError on invalid bindings, blocked court access or conflicting fills.
 */
export function createHouseCourt(
	parcel: ParcelCells,
	occupancy: Occupancy = createOccupancy(parcel.space),
	reservations: Reservations = new Map()
): HouseCourt {
	const { space, inputs } = parcel;
	const byRole = groups(parcel);
	const id = JSON.stringify([parcel.id, 'house']);
	const rooms = (['left', 'right', 'rear'] as const).map((role) => ({
		id: JSON.stringify([parcel.id, role]),
		role,
		cellIds: byRole[role]
	}));
	const court = {
		id: JSON.stringify([parcel.id, 'court']),
		cellIds: byRole.court,
		exitFaceId: parcel.exitFaceId
	};
	const exit = space.faces.find((face) => face.id === court.exitFaceId);
	if (exit?.uses.length !== 1 || exit.uses[0].cellId !== court.cellIds[0])
		throw new RangeError('Court needs an exterior face at its entrance slot');
	for (const group of [...rooms, court]) requireConnectivity(space, group.cellIds);
	const writes: CellWrite[] = rooms.flatMap((room) =>
		room.cellIds.map((cellId) => ({
			id: cellId,
			fill: { kind: 'house', houseId: id, roomId: room.id }
		}))
	);
	for (const cellId of court.cellIds) {
		if (occupancy.get(cellId)?.kind !== 'empty' || reservations.has(cellId))
			throw new RangeError('Court cell is occupied or reserved: ' + cellId);
	}
	const filled = occupyCells(space, occupancy, reservations, writes);
	const protectedCells = new Map(
		[...reservations, ...court.cellIds.map((cellId) => [cellId, court.id] as const)].sort(
			([a], [b]) => (a < b ? -1 : Number(a > b))
		)
	);
	return {
		id,
		space,
		inputs,
		occupancy: filled,
		reservations: protectedCells,
		rooms,
		court
	};
}

export type ExposedHouseFace = Readonly<{ id: string; nodeIds: readonly string[] }>;

function outwardRing(face: CellFace, direction: 1 | -1) {
	return direction === 1 ? [...face.nodeIds] : [...face.nodeIds].reverse();
}

/** Returns detached outward rings in face ID order. Same-house interfaces are omitted. */
export function exposedHouseFaces(house: HouseCourt): readonly ExposedHouseFace[] {
	return house.space.faces.flatMap((face) => {
		const owned = face.uses.filter(({ cellId }) => {
			const fill = house.occupancy.get(cellId);
			return fill?.kind === 'house' && fill.houseId === house.id;
		});
		return owned.length === 1
			? [{ id: face.id, nodeIds: outwardRing(face, owned[0].direction) }]
			: [];
	});
}
