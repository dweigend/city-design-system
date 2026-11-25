import { expect, mock, test } from 'bun:test';
import { required } from '../../core/invariant';
import { readHousePartRefs, type AdjoiningWall } from '../../domain/house-court';
import {
	createSandboxDocument,
	restoreSandboxDocument,
	SandboxDataError,
	type SandboxEdit,
	type SandboxPlacement
} from '../../domain/sandbox-document';
import { createPlacementCache, createSandboxWorld } from '../../world/sandbox-world';
import { createTownHouseStudy, type ParcelHouseResult } from '../../world/house-site';
import { blockTriangleBudget } from '../house-projection';
import { readGeometryMatch as hasSameGeometry } from '../stage';
import { createStrokeDraft } from '../sandbox-interaction';
import { createSandboxProjection } from './index';
import { buildAsset } from '../../world/asset-registry';
import { accessSurfaces, railSurfaces } from '../paths-projection';
import { example } from './example';

test('keeps the town frame reversible and adds only a draped marker for the hovered parcel', () => {
	const { projection, parcel } = example();
	const [x, y] = parcel.outline[0];
	const [wx, wy] = projection.toWorld(...projection.toLocal(x, y));
	expect(wx).toBeCloseTo(x);
	expect(wy).toBeCloseTo(y);
	const marker = projection.projectHover(parcel);
	expect(marker.strokeSegments?.length).toBeGreaterThanOrEqual(parcel.outline.length * 6);
	expect(projection.background.some(({ id }) => id === marker.id)).toBe(false);
});

test.each([
	{
		assetId: 'access/walkway',
		kind: 'access',
		points: [
			[0, 0, 3],
			[10, 0, 3]
		],
		roles: { deck: accessSurfaces.deck, bearing: accessSurfaces.bearing }
	},
	{
		assetId: 'access/stair',
		kind: 'access',
		points: [
			[0, 0, 3],
			[10, 0, 6]
		],
		roles: { stairs: accessSurfaces.stairs, bearing: accessSurfaces.bearing }
	},
	{
		assetId: 'rail/platform',
		kind: 'rail',
		points: [
			[0, 0, 3],
			[10, 0, 3]
		],
		roles: { platform: railSurfaces.platform, bearing: railSurfaces.bearing }
	}
] as const)(
	'projects $assetId with the full Paths role surfaces',
	({ assetId, kind, points, roles }) => {
		const { projection } = example();
		const object = buildAsset(
			assetId,
			{
				kind: 'graph-edge',
				id: 'alignment',
				points,
				supports: [{ base: [0, 0, 0], top: [0, 0, 3] }]
			},
			{},
			1
		);
		const parts = projection.projectPlacement(object, kind, 'placement-1');
		expect(parts).toEqual(
			Object.entries(roles).map(([slot, surface], index) => ({
				id: JSON.stringify(['placement-1', slot]),
				shape: parts[index]?.shape,
				...surface
			}))
		);
	}
);

test('replays part finishes through the sandbox projection with the same shapes and stage geometry', () => {
	const town = createTownHouseStudy();
	const world = createSandboxWorld(town.site, town.layout, town.columns);
	const parcels = town.parcelsByBlock.get(town.blocks.block.id) ?? [];
	const projection = createSandboxProjection(town.site, town.layout, world.holdings);
	const document = world.createDocument();
	const neutral = 'house/court-neutral';
	const hosts = parcels
		.filter(({ publicUse }) => !publicUse)
		.map(({ id }) => ({ kind: 'parcel', id }) as const);
	for (const host of hosts) document.apply([world.place(neutral, host)]);
	const available = document.readPlacements().flatMap((record) => {
		const house = world.resolveHouse(record);
		return house?.status === 'placed' ? [{ record, house }] : [];
	});
	const { record, house } = required(available[0], 'placed house');
	const peer = required(
		available.find(
			({ record: other, house: placed }) =>
				other.id !== record.id &&
				house.parcel.outline.some(([x, y]) =>
					placed.parcel.outline.some(([u, v]) => Math.hypot(x - u, y - v) < 1e-6)
				)
		),
		'adjacent parcel house'
	);
	const { ref, partId } = required(
		readHousePartRefs(house.house, world.world.id).find(({ body }) => body),
		'addressed body'
	);
	const resolve = mock(world.resolveHouse);
	const build = mock(
		(
			placement: SandboxPlacement,
			placed: ParcelHouseResult | undefined,
			walls: readonly AdjoiningWall[]
		) => ({ placement, placed, walls })
	);
	const cache = createPlacementCache(document, build, resolve, (entry, placement) => ({
		...entry,
		placement
	}));
	function readDrawing(level: 'plain' | 'near') {
		const { placement, placed, walls } = required(
			cache.read().find(({ placement }) => placement.id === record.id),
			'cached house'
		);
		if (placed?.status !== 'placed') throw new Error('Expected a placed house');
		return projection.projectParcelHouse(
			placed,
			walls,
			record.id,
			{ budget: blockTriangleBudget, level, tone: 'cream' },
			placement.finishOverrides
		);
	}
	const levels = ['plain', 'near'] as const;
	const before = levels.map(readDrawing);
	resolve.mockClear();
	build.mockClear();
	const finish = { ref, family: 'board', tone: 'blue' } as const;
	const paint = {
		kind: 'replace',
		id: record.id,
		params: record.params,
		finishOverrides: [finish]
	} as const;
	document.apply([paint]);
	expect(resolve).not.toHaveBeenCalled();
	expect(build).not.toHaveBeenCalled();
	expect(cache.readChanges()).toEqual({ built: [], removed: [], restyled: [record.id] });
	const id = JSON.stringify([record.id, partId]);
	for (const [i, level] of levels.entries()) {
		const after = readDrawing(level);
		const beforeDrawable = required(
			before[i].find((part) => part.id === id),
			'initial body'
		);
		const afterDrawable = required(
			after.find((part) => part.id === id),
			'painted body'
		);
		expect(afterDrawable.color).toBe('--model-blue');
		expect(afterDrawable.color).not.toBe(beforeDrawable.color);
		expect(afterDrawable.shape === beforeDrawable.shape).toBe(true);
		expect(
			hasSameGeometry(
				before[i].map((drawable) => ({ drawable })),
				after
			)
		).toBe(true);
	}
	document.undo();
	expect(readDrawing('plain')).toEqual(before[0]);
	document.redo();
	const extension = {
		kind: 'replace',
		id: peer.record.id,
		params: { ...peer.record.params, height: 21 }
	} as const;
	expect(document.apply([extension])).toHaveLength(1);
	expect(world.resolveReference(ref, document).status).toBe('resolved');
	expect(readDrawing('plain').find((part) => part.id === id)?.color).toBe('--model-blue');
	document.undo();
	const saved = world.restore(document.serialize());
	expect(saved.readPlacement(record.host)?.finishOverrides).toEqual([finish]);
	expect(saved.redo()).toHaveLength(1);
	expect(world.resolveReference(ref, saved).status).toBe('resolved');
	saved.undo();
	saved.undo();
	expect(saved.readPlacement(record.host)?.finishOverrides).toBeUndefined();
	saved.redo();
	expect(saved.readPlacement(record.host)?.finishOverrides).toEqual([finish]);

	for (const finishOverrides of [
		[{ ...finish, ref: { ...ref, world: 'another-world' } }],
		[{ ...finish, ref: { ...ref, key: 'face-key' } }],
		[{ ...finish, family: 'unknown' as typeof finish.family }],
		[{ ...finish, tone: 'unknown' as typeof finish.tone }],
		[finish, finish]
	]) {
		const save = document.serialize();
		expect(() => document.apply([{ ...paint, finishOverrides }])).toThrow(SandboxDataError);
		expect(document.serialize()).toBe(save);
	}
});

test('cancelled and no-op strokes preserve the redo branch through save and reload', () => {
	const world = {
		id: 'town',
		registryRevision: 'test',
		terrainRevision: 'flat',
		topologyRevision: 'test'
	};
	const host = { kind: 'parcel', id: 'north' } as const;
	const grove = 'park/grove';
	const document = createSandboxDocument(world);
	const plant = { kind: 'place', assetId: grove, host, params: {} } as const;
	document.apply([plant]);
	const { id, params } = required(document.readPlacement(host), 'grove');
	document.apply([{ kind: 'remove', id }]);
	document.undo();
	const before = document.serialize();

	const draft = createStrokeDraft<SandboxEdit, never>();
	draft.add({ kind: 'remove', id });
	const commit = (edits: readonly SandboxEdit[]) => document.apply(edits);
	draft.finish('cancel', commit);
	draft.finish('release', commit);
	draft.add({ kind: 'replace', id, params });
	draft.finish('release', commit);
	expect(document.serialize()).toBe(before);

	// A multi-edit stroke that paints and clears a finish on the same placement is a net no-op
	// and must keep the redo branch intact.
	const ref = {
		v: 1 as const,
		world: world.id,
		kind: 'house-part' as const,
		key: JSON.stringify(['house/north', 'body-0'])
	};
	expect(
		document.apply([
			{ kind: 'replace', id, params, finishOverrides: [{ ref, family: 'board', tone: 'blue' }] },
			{ kind: 'replace', id, params, finishOverrides: null }
		])
	).toEqual([]);
	expect(document.serialize()).toBe(before);

	const restored = restoreSandboxDocument(document.serialize());
	expect(restored.serialize()).toBe(before);
	restored.redo();
	expect(restored.readPlacement(host)).toBeUndefined();
	restored.undo();
	expect(restored.readPlacement(host)?.assetId).toBe(grove);
	document.redo();
	expect(document.readPlacement(host)).toBeUndefined();
});

test('painting a flat-topped uppermost solid at near detail repaints its roof with the same shape', () => {
	const town = createTownHouseStudy();
	const world = createSandboxWorld(town.site, town.layout, town.columns);
	const parcels = town.parcelsByBlock.get(town.blocks.block.id) ?? [];
	const projection = createSandboxProjection(town.site, town.layout, world.holdings);
	const document = world.createDocument();
	let target:
		| {
				record: SandboxPlacement;
				placed: Extract<ParcelHouseResult, { status: 'placed' }>;
				topRef: ReturnType<typeof readHousePartRefs>[number];
		  }
		| undefined;
	for (const parcel of parcels) {
		if (parcel.publicUse) continue;
		const host = { kind: 'parcel', id: parcel.id } as const;
		document.apply([world.place('house/court-memphis', host)]);
		const record = required(document.readPlacement(host), 'memphis placement');
		const placed = world.resolveHouse(record);
		if (placed?.status === 'placed') {
			const topBody = readHousePartRefs(placed.house, world.world.id)
				.filter(({ body }) => body)
				.sort((a, b) => b.storeySpan[1] - a.storeySpan[1])[0];
			if (topBody) {
				target = { record, placed, topRef: topBody };
				break;
			}
		}
		document.undo();
	}
	const { record, placed, topRef } = required(target, 'placed flat-topped memphis house');
	const options = { budget: blockTriangleBudget, level: 'near' as const, tone: 'pink' as const };
	const before = projection.projectParcelHouse(placed, [], record.id, options);
	const after = projection.projectParcelHouse(placed, [], record.id, options, [
		{ ref: topRef.ref, family: 'board', tone: 'blue' }
	]);
	const topKey = `${record.id}/${encodeURIComponent(JSON.stringify([topRef.partId, 'roof']))}/`;
	const roofBefore = before.filter(
		({ id, fillVisible, finish }) =>
			id.startsWith(topKey) && fillVisible !== false && finish !== 'line'
	);
	const roofAfter = after.filter(
		({ id, fillVisible, finish }) =>
			id.startsWith(topKey) && fillVisible !== false && finish !== 'line'
	);
	expect(roofBefore.length).toBeGreaterThan(0);
	expect(roofAfter.map(({ color }) => color)).toEqual(roofAfter.map(() => '--model-blue'));
	expect(roofAfter.every((part, i) => part.shape === roofBefore[i].shape)).toBe(true);
	expect(
		hasSameGeometry(
			before.map((drawable) => ({ drawable })),
			after
		)
	).toBe(true);
});
