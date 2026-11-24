import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { createWorldReference } from '../../core/world-reference';
import { readCityColumns } from '../../domain/city-volume';
import { createParcelPlan } from '../../domain/parcels';
import { dryPlanEdges, TerrainGrid } from '../../domain/terrain-grid';
import {
	createSandboxDocument,
	restoreSandboxDocument,
	UnavailableHostError
} from '../../domain/sandbox-document';
import {
	createCitySite,
	readCityDistricts,
	readCityGrid,
	type CityGrid,
	type CitySite
} from '../city-site';
import { createSandboxWorld } from './index';

function ledger() {
	const entries = new Map<string, string>();
	return {
		save(label: string, reference: unknown) {
			entries.set(label, JSON.stringify(reference));
		},
		read(label: string): unknown {
			return JSON.parse(required(entries.get(label), label)) as unknown;
		},
		resolve(resolve: (input: unknown) => { status: string }, expected: Record<string, string>) {
			expect(
				Object.fromEntries(
					[...entries]
						.filter(([label]) => label in expected)
						.map(([label, json]) => [label, resolve(JSON.parse(json)).status])
				)
			).toEqual(expected);
		}
	};
}

function sandbox(site: CitySite, layout: CityGrid, revision?: string) {
	const districts = readCityDistricts(site, layout, layout.seed);
	const columns = readCityColumns(layout.grid, districts);
	return {
		districts,
		world: createSandboxWorld(
			site,
			layout,
			new Map(columns.map((column) => [column.planCellId, column])),
			revision,
			'ledger-terrain'
		)
	};
}

test('a JSON ledger resolves city addresses through reload, crossing reorder and both growth thresholds', () => {
	const site = createCitySite();
	const village = sandbox(site, readCityGrid(site, 600));
	const townLayout = readCityGrid(site, 1800);
	const town = sandbox(site, townLayout);
	const city = sandbox(site, readCityGrid(site, 5000));
	expect([village, town, city].map(({ districts }) => districts.settlement)).toEqual([
		'village',
		'town',
		'city'
	]);

	const { world } = village;
	const stored = ledger();
	const parcel = required(
		world.holdings.parcels.find(({ publicUse }) => !publicUse),
		'village parcel'
	);
	const portal = required(
		world.holdings.portals.find(({ id }) => id === parcel.portalId),
		'village portal'
	);
	for (const [kind, key] of [
		['parcel', parcel.id],
		['portal', portal.id],
		['lane', portal.laneId]
	])
		stored.save(kind, createWorldReference(world.world.id, kind, key));
	const doc = world.createDocument();
	doc.apply([world.place('house/court-neutral', { kind: 'parcel', id: parcel.id })]);
	const [placement] = doc.readPlacements();
	stored.save('placement', createWorldReference(world.world.id, 'placement', placement.id));
	expect(stored.read('parcel')).toEqual(placement.hostReference);
	const save = doc.serialize();
	const holds = { parcel: 'resolved', portal: 'resolved', lane: 'resolved' };
	for (const snapshot of [world, town.world, city.world]) {
		stored.resolve(snapshot.resolveReference, holds);
		const restored = snapshot.restore(save);
		stored.resolve(restored.resolveReference, { placement: 'resolved' });
		expect(restored.readPlacements()).toEqual([placement]);
		restored.undo();
		stored.resolve(restored.resolveReference, { placement: 'missing' });
		restored.redo();
		stored.resolve(restored.resolveReference, { placement: 'resolved' });
	}

	expect(townLayout.selectedCrossings.length).toBeGreaterThan(1);
	for (const [i, bridge] of town.world.movement.network.edges
		.filter(({ kind }) => kind === 'bridge')
		.entries())
		stored.save('bridge-' + i, createWorldReference(world.world.id, 'bridge', bridge.id));
	const reversed = sandbox(site, {
		...townLayout,
		selectedCrossings: [...townLayout.selectedCrossings].reverse()
	}).world;
	expect(reversed.movement.network.edges).toEqual(town.world.movement.network.edges);
	expect(reversed.world).toEqual(town.world.world);
	for (const snapshot of [town.world, reversed, city.world]) {
		stored.resolve(snapshot.resolveReference, {
			...holds,
			'bridge-0': 'resolved',
			'bridge-1': 'resolved'
		});
	}
	const otherPlan = sandbox(site, readCityGrid(site, 600, 'triangle')).world;
	stored.resolve(otherPlan.resolveReference, {
		parcel: 'different-world',
		lane: 'different-world'
	});
}, 30000);

test('same-scope terrain revisions change the geometry under a saved placement and movement reference', () => {
	const valley = createCitySite();
	function snapshot(delta: number) {
		const site = createCitySite((x, y) => {
			const ground = valley.sampleGround(x, y);
			return { ...ground, height: ground.height + delta };
		});
		return sandbox(site, readCityGrid(site, 600, 'square'), String(delta)).world;
	}
	const before = snapshot(0);
	const after = snapshot(1e-8);
	const stored = ledger();
	const parcel = required(
		before.holdings.parcels.find(({ publicUse }) => !publicUse),
		'private parcel'
	);
	const edge = required(
		before.movement.network.edges.find(({ lane }) => lane),
		'lane link'
	);
	const doc = before.createDocument();
	doc.apply([before.place('house/court-neutral', { kind: 'parcel', id: parcel.id })]);
	const [placement] = doc.readPlacements();
	stored.save('parcel', placement.hostReference);
	stored.save('lane link', createWorldReference(before.world.id, 'graph-edge', edge.id));
	stored.resolve(after.resolveReference, { parcel: 'resolved', 'lane link': 'resolved' });
	expect(after.world.terrainRevision).not.toBe(before.world.terrainRevision);
	expect(after.movement.network.edges.find(({ id }) => id === edge.id)?.points).not.toEqual(
		edge.points
	);
	expect(after.restore(doc.serialize()).readPlacements()).toEqual([placement]);
}, 20000);

test('a block merge invalidates parcel and portal references and retains the placement only in history', () => {
	const grid = TerrainGrid.create({
		seed: 1,
		variant: 'square',
		parameters: { cellSize: 60 },
		site: {
			origin: [0, 0],
			bearing: 0,
			outline: [
				[0, 0],
				[120, 0],
				[120, 60],
				[0, 60]
			]
		},
		heightAt: () => 0
	});
	const input = {
		grid,
		lanes: dryPlanEdges(grid, grid).map((edge) => ({
			edge,
			hierarchy: [],
			widthM: 3,
			surface: 'walk' as const
		})),
		plannedKinds: Object.fromEntries(grid.cells.map(({ id }) => [id, 'home'])),
		holdingRules: { home: { minimumFrontageM: 3 } },
		tolerance: { linearToleranceM: 1e-6, areaToleranceM2: 0.01, relativeAreaToleranceRatio: 1e-8 }
	};
	const before = createParcelPlan(input).read();
	const memberCellIds = [grid.cells[0].id, grid.cells[1].id] as const;
	const after = createParcelPlan({
		...input,
		merges: [{ memberCellIds, plannedKind: 'home' }]
	}).read();
	expect(after.blocks).toHaveLength(1);
	const scope = {
		id: 'ledger/plan',
		terrainRevision: 'flat',
		topologyRevision: 'separate',
		registryRevision: 'ledger-registry'
	};
	const [parcel] = before.parcels;
	const doc = createSandboxDocument(scope);
	doc.apply([
		{ kind: 'place', assetId: 'house/neutral', host: { kind: 'parcel', id: parcel.id }, params: {} }
	]);
	const [placement] = doc.readPlacements();
	const stored = ledger();
	stored.save('parcel', placement.hostReference);
	stored.save('portal', createWorldReference(scope.id, 'portal', parcel.portalId));
	stored.save('placement', createWorldReference(scope.id, 'placement', placement.id));
	expect(after.parcels.some(({ id }) => id === parcel.id)).toBe(false);
	expect(after.portals.some(({ id }) => id === parcel.portalId)).toBe(false);
	const resolve = (
		_asset: string,
		host: typeof placement.host,
		params: typeof placement.params
	) => {
		if (host.kind !== 'parcel' || !after.parcels.some(({ id }) => id === host.id))
			throw new UnavailableHostError('Missing parcel');
		return params;
	};
	const restored = restoreSandboxDocument(
		doc.serialize(),
		{ ...scope, topologyRevision: 'merged' },
		resolve
	);
	stored.resolve(restored.resolveReference, { placement: 'missing' });
	expect(restored.readPlacements()).toEqual([]);
	expect(restored.readOrphans()).toEqual([placement]);
	const projected: unknown[] = [];
	restored.attach((changes) => projected.push(...changes));
	restored.undo();
	expect(restored.readOrphans()).toEqual([]);
	restored.redo();
	expect(restored.readOrphans()).toEqual([placement]);
	expect(projected).toEqual([]);
	expect(
		restoreSandboxDocument(restored.serialize(), restored.world, resolve).readOrphans()
	).toEqual([placement]);
});
