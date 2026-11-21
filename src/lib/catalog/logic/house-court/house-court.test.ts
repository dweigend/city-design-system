import { expect, test } from 'bun:test';
import { random } from '../../core/random';
import { createOccupancy, occupyCells } from '../occupancy';
import { createParcelDeck } from '../parcel-deck';
import { createHouseCourt, exposedHouseFaces } from './index';

const plot = {
	id: 'seed-7-plot',
	entrance: [
		[0, 0, 0],
		[12, 0, 0]
	],
	depth: 12
} as const;
const base = { width: 9, height: 3, complexity: 0 };
const deck = createParcelDeck(plot, base, 7);
const { space, slots } = deck;
const a = createHouseCourt(deck, base);
const fills = slots.map(({ cellId }) => a.occupancy.get(cellId));
const ids = (model: typeof a) => [model.court.id, ...model.rooms.map(({ id }) => id)];
const cellId = (index: number) => slots[index].cellId;
const contacts = (left: number, right: number) =>
	space.faces.filter(({ uses }) =>
		[cellId(left), cellId(right)].every((id) => uses.some(({ cellId }) => cellId === id))
	);

test('one conforming metric deck', () => {
	expect(space.cells).toHaveLength(9);
	for (const height of [0, 3])
		expect(space.nodes.filter(({ position }) => position[2] === height)).toHaveLength(16);
	const shared = space.faces.filter(({ uses }) => uses.length === 2);
	expect(shared).toHaveLength(12);
	expect(space.faces.filter(({ uses }) => uses.length === 1)).toHaveLength(30);
	for (const face of shared) expect(face.uses[0].direction + face.uses[1].direction).toBe(0);
	for (const cell of space.cells) expect(cell.volumeM3).toBeCloseTo(27, 8);
	expect(contacts(0, 4)).toHaveLength(0);
});

test('seven house cells, three rooms and an addressable court with an exit', () => {
	expect(fills.map((fill) => fill?.kind)).toEqual([
		'house',
		'empty',
		'house',
		'house',
		'empty',
		'house',
		'house',
		'house',
		'house'
	]);
	expect(a.rooms).toHaveLength(3);
	expect(new Set(fills.flatMap((fill) => (fill?.kind === 'house' ? [fill.roomId] : []))).size).toBe(
		3
	);
	expect(a.court.cellIds).toEqual([cellId(1), cellId(4)]);
	expect(a.reservations).toEqual(new Map(a.court.cellIds.map((id) => [id, a.court.id])));
	const volume = (selected: readonly string[]) =>
		space.cells
			.filter(({ id }) => selected.includes(id))
			.reduce((sum, cell) => sum + cell.volumeM3, 0);
	expect(volume(a.rooms.flatMap((room) => room.cellIds))).toBeCloseTo(189, 8);
	expect(volume(a.court.cellIds)).toBeCloseTo(54, 8);
	expect(contacts(1, 4)).toHaveLength(1);
	const entrance = space.faces.find(
		({ uses, nodeIds }) =>
			uses.length === 1 &&
			uses[0].cellId === cellId(1) &&
			nodeIds.every((id) => space.nodes.find((node) => node.id === id)?.position[1] === 1.5)
	);
	expect(entrance?.id).toBe(a.court.exitFaceId);
});

test('a conflicting bridge or reservation leaves the entire batch untouched', () => {
	const bridge = occupyCells(space, createOccupancy(space), new Map(), [
		{ id: cellId(0), fill: { kind: 'bridge', connectionId: 'crossing' } }
	]);
	const before = structuredClone(bridge);
	expect(() => createHouseCourt(deck, base, bridge)).toThrow('occupied');
	expect(bridge).toEqual(before);

	const empty = createOccupancy(space);
	const emptyBefore = structuredClone(empty);
	const fill = { kind: 'house', houseId: 'house', roomId: 'room' } as const;
	const writes = [cellId(0), cellId(1)].map((id) => ({ id, fill }));
	expect(() => occupyCells(space, empty, a.reservations, writes)).toThrow('reserved');
	expect(empty).toEqual(emptyBefore);
	expect(() => occupyCells(space, empty, new Map(), [{ id: 'missing', fill }])).toThrow('Unknown');
	expect(() => occupyCells(space, empty, new Map(), [writes[0], writes[0]])).toThrow('Duplicate');
});

test('dimensions change while addresses and canonical order stay fixed', () => {
	const inputs = { width: 6, height: 4, complexity: 1 };
	const narrower = createParcelDeck(plot, inputs, 7);
	const b = createHouseCourt(narrower, inputs);
	const points = b.space.nodes.map(({ position }) => position);
	const xs = points.map(([x]) => x);
	const topAt = (y: number) => Math.max(...points.filter((p) => p[1] === y).map((p) => p[2]));
	expect(Math.max(...xs) - Math.min(...xs)).toBe(6);
	expect(topAt(9)).toBe(4);
	expect(topAt(3)).toBe(2);
	expect(ids(b)).toEqual(ids(a));
	expect([...b.occupancy]).toEqual([...a.occupancy]);
	const reversed = createHouseCourt(
		{ ...narrower, slots: [...narrower.slots].reverse() },
		inputs,
		new Map([...createOccupancy(b.space)].reverse())
	);
	expect(reversed).toEqual(b);
	expect([...reversed.occupancy]).toEqual([...b.occupancy]);
});

test('the same iso snapshot exposes the three court walls and hides house contacts', () => {
	const before = structuredClone(a);
	const caller = random(7);
	const control = random(7);
	expect(caller()).toBe(control());
	const faceIds = exposedHouseFaces(a).map(({ id }) => id);
	expect(faceIds).toHaveLength(30);
	for (const [left, right] of [
		[0, 1],
		[1, 2],
		[3, 4],
		[4, 5],
		[4, 7]
	])
		expect(faceIds).toContain(contacts(left, right)[0].id);
	for (const [left, right] of [
		[0, 3],
		[2, 5],
		[3, 6],
		[5, 8],
		[6, 7],
		[7, 8]
	])
		expect(faceIds).not.toContain(contacts(left, right)[0].id);
	expect(exposedHouseFaces(a).map(({ id }) => id)).toEqual(faceIds);
	expect(a).toEqual(before);
	expect(caller()).toBe(control());
});
