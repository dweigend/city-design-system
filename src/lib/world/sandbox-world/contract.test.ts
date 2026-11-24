import { expect, test } from 'bun:test';
import { createSandboxDocument, type PlacementChange } from '../../domain/sandbox-document';
import { houseStyles } from '../../domain/house-court';
import { createParcelHouse, createParcelHouseObject } from '../house-site';
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
	const { world, parcels } = example();
	const document = createSandboxDocument(world.world);
	const cache = createPlacementCache(world.build);
	const edits = parcels.map(({ id }) => world.place('house/court-memphis', { kind: 'parcel', id }));
	expect(edits.length).toBeGreaterThan(1);
	document.apply(edits, cache.apply);
	expect(cache.read()).toHaveLength(edits.length);
	const placement = document.readPlacements()[0];
	const host = world.resolveHost(placement.host);
	if (host.kind !== 'parcel' || !('site' in host)) throw new Error('Expected a city parcel');
	const fromBible = createParcelHouseObject(
		createParcelHouse(
			host.site,
			{ ...placement.params, seed: placement.seed },
			houseStyles.memphis
		),
		'full'
	);
	expect(world.build(placement)).toEqual(fromBible);
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
