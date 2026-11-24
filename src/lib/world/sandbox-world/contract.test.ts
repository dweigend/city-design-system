import { expect, test } from 'bun:test';
import {
	createSandboxDocument,
	readPlacementId,
	SandboxDataError,
	type SandboxEdit,
	type PlacementChange
} from '../../domain/sandbox-document';
import { houseStyles, readPartyWallExposure, type AdjoiningWall } from '../../domain/house-court';
import {
	createParcelHouse,
	createParcelHouseObject,
	createTownHouseStudy,
	readParcelHouseWalls
} from '../house-site';
import { readCityGrid } from '../city-site';
import { readAsset } from '../asset-registry';
import { resolveParams } from '../../core/params';
import { createPlacementCache, createSandboxWorld, UnavailableHostError } from './index';
import { example } from './example';

const testWorld = {
	seed: 1,
	planFamily: 'fixed',
	citySize: 600,
	terrainRevision: 'terrain-test',
	topologyRevision: 'topology-test'
};

test('builds only arriving records and removes only departing records', () => {
	const document = createSandboxDocument(testWorld);
	const cache = createPlacementCache(document, (placement) => ({ placement }));
	const place = (id: string) =>
		({
			kind: 'place',
			assetId: 'access/walkway',
			host: { kind: 'graph-edge', id },
			params: {}
		}) as const;
	document.apply([place('existing')]);
	const existing = cache.read()[0];
	const changes = document.apply(Array.from({ length: 30 }, (_, i) => place(String(i))));
	expect(cache.readChanges().built).toEqual(changes.map(({ id }) => id));
	expect(cache.read()).toHaveLength(31);
	document.undo();
	expect(cache.readChanges()).toEqual({ built: [], removed: changes.map(({ id }) => id) });
	expect(cache.read()[0]).toBe(existing);
	document.redo();
	expect(cache.read()).toHaveLength(31);
});

test('paints and undoes an Architecture Town stroke through the registry', () => {
	const { world, town, parcels } = example();
	const document = world.createDocument();
	const cache = createPlacementCache(
		document,
		(_, house, adjoining) => {
			if (house?.status !== 'placed') return house;
			return createParcelHouseObject(house, 'full', adjoining);
		},
		world.resolveHouse
	);
	const edits = parcels.map(({ id }) => world.place('house/court-memphis', { kind: 'parcel', id }));
	expect(edits.length).toBeGreaterThan(1);
	document.apply(edits);
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

	document.undo();
	expect(cache.read()).toEqual([]);
	expect(world.restore(document.serialize()).readHistory()).toEqual(document.readHistory());
});

test('builds a walkway from an addressed edge in the town movement graph', () => {
	const { world } = example();
	const edge = world.movement.network.edges.find(({ points }) => points.length > 1);
	if (!edge) throw new Error('Expected a town movement edge');
	const document = world.createDocument();
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
	const document = world.createDocument();
	const edit = (parcelId: string) =>
		world.place('house/court-neutral', { kind: 'parcel', id: parcelId }, params);
	const preview = world.createDocument();
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
	const cache = createPlacementCache(
		document,
		(placement, house, adjoining: readonly AdjoiningWall[]) => {
			if (fail && placement.id === a.placement.id) throw Error('Failed adjoining build');
			const exposure =
				house?.status === 'placed'
					? readPartyWallExposure(house.space, house.house, adjoining)
					: '';
			return { id: placement.id, exposure };
		},
		world.resolveHouse
	);
	document.apply([edit(a.house.parcel.id), edit(c.house.parcel.id)]);
	const untouched = cache.read().find(({ id }) => id === c.placement.id);
	const before = cache.read();
	fail = true;
	expect(() => document.apply([edit(b.house.parcel.id)])).toThrow('Failed adjoining build');
	expect(cache.read()).toEqual(before);
	expect(document.readHistory().placements).toBe(2);
	fail = false;
	const idB = readPlacementId(world.world, b.placement.host);
	document.apply([edit(b.house.parcel.id)]);
	expect(cache.readChanges()).toEqual({ built: [idB, a.placement.id], removed: [] });
	const contact = cache.read().find(({ id }) => id === a.placement.id)?.exposure;
	expect(contact).not.toBe(before.find(({ id }) => id === a.placement.id)?.exposure);
	document.undo();
	expect(cache.readChanges()).toEqual({ built: [a.placement.id], removed: [idB] });
	expect(cache.read()).toEqual(before);
	expect(cache.read().find(({ id }) => id === c.placement.id)).toBe(untouched);
	document.redo();
	expect(cache.read().find(({ id }) => id === a.placement.id)?.exposure).toBe(contact);
});

test('derives snapshot identity from the resolved city size, terrain and topology', () => {
	const {
		world,
		town: { site, layout, columns }
	} = example();
	expect(world.world.citySize).toBe(layout.citySize);
	const other = createSandboxWorld(site, readCityGrid(site, 600), columns);
	expect(other.world.citySize).toBe(600);
	const saved = world.createDocument().serialize();
	expect(() => other.restore(saved)).toThrow(SandboxDataError);

	const smaller = new Map(columns);
	const [id, column] = Array.from(smaller)[0];
	smaller.set(id, { ...column, levels: column.levels + 1 });
	const changed = createSandboxWorld(site, layout, smaller);
	expect(changed.world.topologyRevision).not.toBe(world.world.topologyRevision);
	expect(() => changed.restore(saved)).toThrow(SandboxDataError);
	const slope = createTownHouseStudy({ relief: 0.5 });
	const differentGround = createSandboxWorld(slope.site, slope.layout, slope.columns);
	expect(differentGround.world.terrainRevision).not.toBe(world.world.terrainRevision);
	expect(() => differentGround.restore(saved)).toThrow(SandboxDataError);
	expect(() => world.restore(saved.replace('sandbox/2', 'sandbox/1'))).toThrow(
		'lacks terrain and topology revisions'
	);
}, 20000);

test('rejects transient invalid placements and replacements in the redo tail', () => {
	const { world, parcels } = example();
	const good = world.place('house/court-neutral', { kind: 'parcel', id: parcels[0].id });
	const unavailable = { kind: 'parcel', id: 'outside' } as const;
	const badEdits: SandboxEdit[] = [
		{ ...good, host: unavailable, assetId: 'house/unknown' },
		{ ...good, host: unavailable },
		{ ...good, assetId: 'house/unknown' }
	];
	for (const bad of badEdits) {
		if (bad.kind !== 'place') throw Error('Expected a placement');
		const log = createSandboxDocument(world.world);
		log.apply([bad, { kind: 'remove', id: readPlacementId(world.world, bad.host) }, good]);
		log.undo();
		expect(() => world.restore(log.serialize())).toThrow();
	}
	const log = createSandboxDocument(world.world);
	log.apply([good]);
	const id = readPlacementId(world.world, good.host);
	log.apply([
		{ kind: 'replace', id, params: { nonexistent: 1 } },
		{ kind: 'remove', id }
	]);
	log.undo();
	expect(() => world.restore(log.serialize())).toThrow('Unknown parameter');
});

test('stores registry parameters in placed, replaced and imported records', () => {
	const { world, parcels } = example();
	const assetId = 'house/court-neutral';
	const host = { kind: 'parcel', id: parcels[0].id } as const;
	const expected = resolveParams(readAsset(assetId).params, { height: 999999 });
	const document = world.createDocument();
	document.apply([{ kind: 'place', assetId, host, params: { height: 999999 } }]);
	expect(document.readPlacement(host)?.params).toEqual(expected);
	const id = readPlacementId(world.world, host);
	document.apply([{ kind: 'replace', id, params: { height: 3 } }]);
	document.apply([{ kind: 'replace', id, params: { height: 999999 } }]);
	expect(document.readPlacement(host)?.params).toEqual(expected);
	expect(document.serialize()).not.toContain('999999');

	const raw = createSandboxDocument(world.world);
	raw.apply([{ kind: 'place', assetId, host, params: { height: 3 } }]);
	raw.apply([{ kind: 'replace', id, params: { height: 999999 } }]);
	raw.undo();
	const restored = world.restore(raw.serialize());
	expect(restored.readPlacement(host)?.params).toEqual(
		resolveParams(readAsset(assetId).params, { height: 3 })
	);
	restored.redo();
	expect(restored.readPlacement(host)?.params).toEqual(expected);
	expect(restored.serialize()).not.toContain('999999');
});

test('rejects a flat two-point graph edge before recording a stair', () => {
	const { world } = example();
	const edge = world.movement.network.edges.find(
		({ points }) => points.length === 2 && points[0][2] === points[1][2]
	);
	if (!edge) throw Error('Expected a level lane');
	const host = { kind: 'graph-edge', id: edge.id } as const;
	expect(() => world.place('access/stair', host)).toThrow(UnavailableHostError);
	const doc = world.createDocument();
	expect(() => doc.apply([{ kind: 'place', assetId: 'access/stair', host, params: {} }])).toThrow(
		UnavailableHostError
	);
	expect(doc.readPlacements()).toEqual([]);
});

test('owns each placement cache by document even when worlds and placement IDs coincide', () => {
	const first = createSandboxDocument(testWorld);
	const second = createSandboxDocument(testWorld);
	const a = createPlacementCache(first, ({ seed }) => seed);
	const b = createPlacementCache(second, ({ seed }) => seed);
	const base = {
		kind: 'place',
		assetId: 'access/walkway',
		host: { kind: 'graph-edge', id: 'same' },
		params: {}
	} as const;
	first.apply([{ ...base, seed: 1 }]);
	second.apply([{ ...base, seed: 2 }]);
	expect(first.readPlacements()[0].id).toBe(second.readPlacements()[0].id);
	first.undo();
	expect(a.read()).toEqual([]);
	expect(b.read()).toEqual([2]);
	expect(() => createPlacementCache(second, ({ seed }) => seed)).toThrow(
		'already owns a projection'
	);
	expect(b.read()).toEqual([2]);
});
