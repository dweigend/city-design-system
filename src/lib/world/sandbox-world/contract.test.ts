import { expect, test } from 'bun:test';
import {
	createSandboxDocument,
	readPlacementId,
	type PlacementChange
} from '../../domain/sandbox-document';
import { houseStyles, readPartyWallExposure, type AdjoiningWall } from '../../domain/house-court';
import { createParcelHouse, createParcelHouseObject, readParcelHouseWalls } from '../house-site';
import { createPlacementCache } from './index';
import { example } from './example';

test('builds only arriving records and removes only departing records', () => {
	const document = createSandboxDocument({ seed: 1, planFamily: 'fixed', citySize: 600 });
	const cache = createPlacementCache((placement) => ({ placement }));
	const place = (id: string) =>
		({
			kind: 'place',
			assetId: 'access/walkway',
			host: { kind: 'graph-edge', id },
			params: {}
		}) as const;
	document.apply([place('existing')], cache.apply);
	const existing = cache.read()[0];
	const changes = document.apply(
		Array.from({ length: 30 }, (_, i) => place(String(i))),
		(delta) => {
			expect(cache.apply(delta).built).toEqual(delta.map(({ id }) => id));
		}
	);
	expect(cache.read()).toHaveLength(31);
	document.undo((delta) => {
		const { built, removed } = cache.apply(delta);
		expect(built).toEqual([]);
		expect(removed).toEqual(changes.map(({ id }) => id));
	});
	expect(cache.read()[0]).toBe(existing);
	document.redo(cache.apply);
	expect(cache.read()).toHaveLength(31);
});

test('paints and undoes an Architecture Town stroke through the registry', () => {
	const { world, town, parcels } = example();
	const document = createSandboxDocument(world.world);
	const cache = createPlacementCache((_, house, adjoining) => {
		if (house?.status !== 'placed') return house;
		return createParcelHouseObject(house, 'full', adjoining);
	}, world.resolveHouse);
	const edits = parcels.map(({ id }) => world.place('house/court-memphis', { kind: 'parcel', id }));
	expect(edits.length).toBeGreaterThan(1);
	document.apply(edits, cache.apply);
	expect(cache.read()).toHaveLength(edits.length);
	const placement = document
		.readPlacements()
		.find((record) => world.resolveHouse(record)?.status === 'placed');
	if (placement?.host.kind !== 'parcel') throw Error('Expected a built Town parcel');
	const site = town.readParcelSite(placement.host.id);
	if (!site) throw new Error('Expected a town parcel');
	const house = createParcelHouse(
		site,
		{ ...placement.params, seed: placement.seed },
		houseStyles.memphis
	);
	if (house.status !== 'placed') throw Error(house.reason);
	const fromBible = createParcelHouseObject(house, 'full');
	expect(world.build(placement)).toEqual(fromBible);
	expect(world.resolveHouse(placement)).toEqual(house);
	const garden = cache.read().find((result) => result && 'status' in result);
	expect(garden).toMatchObject({ status: 'unbuildable', reason: 'no-built-cells' });

	document.undo(cache.apply);
	expect(cache.read()).toEqual([]);
	expect(world.restore(document.serialize()).readHistory()).toEqual(document.readHistory());
});

test('builds a walkway from an addressed edge in the town movement graph', () => {
	const { world } = example();
	const edge = world.movement.network.edges.find(({ points }) => points.length > 1);
	if (!edge) throw new Error('Expected a town movement edge');
	const document = createSandboxDocument(world.world);
	const edit = world.place('access/walkway', { kind: 'graph-edge', id: edge.id });
	const capture = (changes: readonly PlacementChange[]) => {
		const { after } = changes[0];
		if (!after) throw new Error('Expected a placement');
		expect(world.build(after).parts.length).toBeGreaterThan(0);
	};
	document.apply([edit], capture);
});

test('rebuilds an occupied party-wall neighbour on paint and undo and reuses an unrelated object', () => {
	const { world, parcels, town } = example();
	const params = { height: 14, width: 28, complexity: 0.6 };
	const document = createSandboxDocument(world.world);
	const edit = (parcelId: string) =>
		world.place('house/court-neutral', { kind: 'parcel', id: parcelId }, params);
	const preview = createSandboxDocument(world.world);
	preview.apply(parcels.map(({ id }) => edit(id)));
	const houses = preview.readPlacements().flatMap((placement) => {
		const house = world.resolveHouse(placement);
		return house?.status === 'placed'
			? [{ placement, house, walls: readParcelHouseWalls(house) }]
			: [];
	});
	const [a, b] =
		houses.flatMap((first) =>
			houses.flatMap((second) =>
				first !== second &&
				readPartyWallExposure(first.house.space, first.house.house, second.walls)
					? [[first, second]]
					: []
			)
		)[0] ?? [];
	if (!a || !b) throw Error('Expected a contacting pair of Town houses');
	const c = houses.find(
		(candidate) =>
			candidate !== a &&
			candidate !== b &&
			!readPartyWallExposure(candidate.house.space, candidate.house.house, b.walls) &&
			!readPartyWallExposure(b.house.space, b.house.house, candidate.walls)
	);
	if (!c) throw Error('Expected an unrelated Town house');
	const block = town.blocks.block;
	expect(a.house.parcel.blockId).toBe(block.id);
	expect(b.house.parcel.blockId).toBe(block.id);
	expect(c.house.parcel.blockId).toBe(block.id);

	let fail = false;
	const cache = createPlacementCache((placement, house, adjoining: readonly AdjoiningWall[]) => {
		if (fail && placement.id === a.placement.id) throw Error('Failed adjoining build');
		const exposure =
			house?.status === 'placed' ? readPartyWallExposure(house.space, house.house, adjoining) : '';
		return { id: placement.id, exposure };
	}, world.resolveHouse);
	document.apply([edit(a.house.parcel.id), edit(c.house.parcel.id)], cache.apply);
	const untouched = cache.read().find(({ id }) => id === c.placement.id);
	const before = cache.read();
	fail = true;
	expect(() => document.apply([edit(b.house.parcel.id)], cache.apply)).toThrow(
		'Failed adjoining build'
	);
	expect(cache.read()).toEqual(before);
	expect(document.readHistory().placements).toBe(2);
	fail = false;
	const idB = readPlacementId(world.world, b.placement.host);
	document.apply([edit(b.house.parcel.id)], (delta) => {
		expect(cache.apply(delta)).toEqual({ built: [idB, a.placement.id], removed: [] });
	});
	const contact = cache.read().find(({ id }) => id === a.placement.id)?.exposure;
	expect(contact).not.toBe(before.find(({ id }) => id === a.placement.id)?.exposure);
	document.undo((delta) => {
		expect(cache.apply(delta)).toEqual({ built: [a.placement.id], removed: [idB] });
	});
	expect(cache.read()).toEqual(before);
	expect(cache.read().find(({ id }) => id === c.placement.id)).toBe(untouched);
	document.redo(cache.apply);
	expect(cache.read().find(({ id }) => id === a.placement.id)?.exposure).toBe(contact);
});
