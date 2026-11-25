import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { readHousePartRefs } from '../../domain/house-court';
import { SandboxDataError } from '../../domain/sandbox-document';
import { example } from './example';

const houseAsset = 'house/court-neutral';
const playerAsset = 'park/grove';

function placeableHouse() {
	const { world, parcels } = example();
	const document = world.createDocument();
	for (const { id, publicUse } of parcels) {
		if (publicUse) continue;
		const host = { kind: 'parcel', id } as const;
		const edit = world.place(houseAsset, host);
		document.apply([edit]);
		const record = required(document.readPlacement(host), 'initial placement');
		const placed = world.resolveHouse(record);
		if (placed?.status === 'placed') return { world, document, host, edit, record, placed };
		document.undo();
	}
	throw new Error('Expected a buildable town house');
}

test('overwrites generated stock and recovers its exact geometry after erasure, undo, redo and reload', () => {
	const { world, host, edit } = placeableHouse();
	const document = world.createDocument([{ ...edit, seed: 1234 }]);
	const generated = required(document.readPlacement(host), 'generated stock');
	const geometry = world.build(generated);
	expect(document.readHistory()).toEqual({ placements: 1, position: 0, strokes: 0 });
	expect(document.readStock(host)).toBe(generated);

	document.apply([world.place(playerAsset, host)]);
	const player = required(document.readPlacement(host), 'player placement');
	expect(player.assetId).toBe(playerAsset);
	expect(document.readStock(host)).toBe(generated);
	document.undo();
	expect(document.readPlacement(host)).toBe(generated);
	document.redo();
	expect(document.readPlacement(host)).toBe(player);
	document.apply([{ kind: 'remove', id: player.id }]);
	expect(document.readPlacement(host)).toBe(generated);
	document.undo();

	const restored = world.restore(document.serialize());
	expect(restored.serialize()).toBe(document.serialize());
	expect(restored.readPlacement(host)).toEqual(player);
	restored.redo();
	const recovered = required(restored.readPlacement(host), 'recovered stock');
	expect(restored.readStock(host)).toBe(recovered);
	expect(world.build(recovered)).toEqual(geometry);
	restored.apply([{ kind: 'remove', id: recovered.id }]);
	expect(restored.readPlacement(host)).toBeUndefined();
	const cleared = world.restore(restored.serialize());
	expect(cleared.readPlacement(host)).toBeUndefined();
	cleared.undo();
	expect(cleared.readPlacement(host)).toEqual(generated);
});

test('swaps building types in one remove-and-place stroke and restores the old finish on undo', () => {
	const { world, host, document, record, placed } = placeableHouse();
	const { ref } = required(
		readHousePartRefs(placed.house, world.world.id).find(({ body }) => body),
		'body ref'
	);
	document.apply([
		{
			kind: 'replace',
			id: record.id,
			params: record.params,
			finishOverrides: [{ ref, family: 'board', tone: 'blue' }]
		}
	]);
	const finished = document.readPlacement(host);
	const change = document.apply([
		{ kind: 'remove', id: record.id },
		world.place('house/court-organic', host)
	]);
	expect(change).toHaveLength(1);
	const swapped = document.readPlacement(host);
	expect(swapped?.id).toBe(record.id);
	expect(swapped?.assetId).toBe('house/court-organic');
	expect(swapped?.finishOverrides).toBeUndefined();
	document.undo();
	expect(document.readPlacement(host)).toBe(finished);
	const restored = world.restore(document.serialize());
	expect(restored.readPlacement(host)).toEqual(finished);
	restored.redo();
	expect(restored.readPlacement(host)).toEqual(swapped);
	restored.undo();
	expect(restored.readPlacement(host)).toEqual(finished);
});

test('applies a sparse vertical override to one contiguous headless column before minting part refs', () => {
	const { world, host, document, record, placed } = placeableHouse();
	const cell = required(
		placed.house.cells.find(
			({ fromStorey, toStorey }) => toStorey > fromStorey && toStorey < placed.space.storeyCount
		),
		'extendable column'
	);
	const nextCount = cell.toStorey - cell.fromStorey + 1;
	const change = {
		kind: 'replace',
		id: record.id,
		params: record.params,
		cellOverrides: { [cell.id]: nextCount }
	} as const;
	function readColumn() {
		const placement = required(document.readPlacement(host), 'edited placement');
		const result = world.resolveHouse(placement);
		if (result?.status !== 'placed') throw new Error('Expected a placed house');
		return { result, column: result.house.cells.find(({ id }) => id === cell.id) };
	}
	document.apply([change]);
	const { result, column } = readColumn();
	expect(column).toEqual({ ...cell, toStorey: cell.toStorey + 1 });
	expect(result.house.cells.filter(({ id }) => id !== cell.id)).toEqual(
		placed.house.cells.filter(({ id }) => id !== cell.id)
	);
	for (const court of result.house.entrances) expect(court.length).toBeGreaterThan(0);
	const addresses = readHousePartRefs(result.house, world.world.id);
	expect(
		addresses.some(
			({ cellId, body, storeySpan }) =>
				body && cellId === cell.id && storeySpan[1] === placed.space.datumIndex + cell.toStorey + 1
		)
	).toBe(true);
	const geometry = world.build(required(document.readPlacement(host), 'extended placement'));
	document.undo();
	expect(document.readPlacement(host)).toBe(record);
	const restored = world.restore(document.serialize());
	restored.redo();
	expect(world.build(required(restored.readPlacement(host), 'replayed extension'))).toEqual(
		geometry
	);
	document.redo();
	expect(readColumn().column).toEqual(column);
	document.apply([{ ...change, cellOverrides: { [cell.id]: Number.MAX_SAFE_INTEGER } }]);
	expect(readColumn().column?.toStorey).toBe(placed.space.storeyCount);
	document.undo();

	for (const cellOverrides of [
		{ missing: 1 },
		{ [cell.id]: -1 },
		{ [cell.id]: 1.5 },
		Object.fromEntries(
			placed.house.cells
				.filter(({ fromStorey, toStorey }) => toStorey > fromStorey)
				.map(({ id }) => [id, 0])
		)
	]) {
		const before = document.serialize();
		expect(() => document.apply([{ ...change, cellOverrides }])).toThrow(SandboxDataError);
		expect(document.serialize()).toBe(before);
	}
});
