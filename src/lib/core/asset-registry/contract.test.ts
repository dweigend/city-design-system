import { expect, test } from 'bun:test';
import { bounds, PlaceableObject } from '../object';
import { defineParams, resolveParams } from '../params';
import { createAssetBuild, createAssetRegistry, type AssetEntry } from './index';
import { example } from './example';

test('validates lowercase segmented IDs and rejects duplicates', () => {
	const entry: AssetEntry = {
		id: 'x-1/survey',
		kind: 'marker',
		tags: ['survey'],
		params: {},
		hostKinds: ['ground'],
		build: example
	};
	expect(createAssetRegistry([entry]).readAsset(entry.id).id).toBe(entry.id);
	for (const id of ['Survey', '1survey', 'x//survey', 'x--1', 'x/', 'x y', 'x\n']) {
		expect(() => createAssetRegistry([{ ...entry, id }])).toThrow(RangeError);
	}
	expect(() => createAssetRegistry([entry, entry])).toThrow(RangeError);
});

test('runs the marker example on a free ground point', () => {
	expect(example().anchors[0].position).toEqual([2, 3, 0]);
});

test('saved default parameters replay into the same bounds', () => {
	const id = 'marker/width';
	const host = { kind: 'ground', point: [0, 0, 0] } as const;
	const params = defineParams({
		width: { label: 'Width', unit: 'm', default: 0.3, min: 0, max: 1, step: 0.5 }
	});
	const registry = createAssetRegistry([
		{
			id,
			kind: 'marker',
			tags: [],
			hostKinds: ['ground'],
			params,
			build(_host, { width }) {
				return PlaceableObject.create({
					id,
					footprint: { width, depth: 1 },
					slots: ['body'],
					parts: [
						{
							id: 'body',
							slot: 'body',
							shape: {
								kind: 'box',
								center: [0, 0, 0],
								size: [width, 1, 1],
								rotation: 0
							}
						}
					],
					anchors: []
				});
			}
		}
	]);
	const saved = JSON.parse(JSON.stringify(resolveParams(params)));
	const original = registry.buildAsset(id, host, {}, 1);
	const replay = registry.buildAsset(id, host, saved, 1);
	expect(resolveParams(params, saved)).toEqual({ width: 0.3 });
	expect(bounds(original)).toEqual({ min: [-0.15, -0.5, -0.5], max: [0.15, 0.5, 0.5] });
	expect(bounds(replay)).toEqual(bounds(original));
});

test('registry reuses validated objects and detaches external builder output', () => {
	const immutable = example();
	const position = [1, 2, 3] as [number, number, number];
	const external = Object.freeze({
		...immutable,
		anchors: [{ ...immutable.anchors[0], position }]
	});
	const entry: AssetEntry = {
		id: 'marker/built',
		kind: 'marker',
		tags: [],
		params: {},
		hostKinds: ['ground'],
		build: () => immutable
	};
	const registry = createAssetRegistry([
		entry,
		{ ...entry, id: 'marker/external', build: () => external },
		{
			...entry,
			id: 'marker/invalid',
			build: () => ({ ...external, footprint: { width: -1, depth: 0 } })
		}
	]);
	const host = { kind: 'ground', point: [0, 0, 0] } as const;
	const built = registry.buildAsset('marker/built', host, {}, 1);
	const detached = registry.buildAsset('marker/external', host, {}, 1);
	expect(() => registry.buildAsset('marker/invalid', host, {}, 1)).toThrow(RangeError);
	expect(detached).not.toBe(external);
	position[0] = 9;
	expect(detached.anchors[0].position).toEqual([1, 2, 3]);
	expect(built).toBe(immutable);
});

test('an external builder may return bare geometry with an unrelated object property', () => {
	const geometry = { ...example(), object: 'external builder metadata' };
	const registry = createAssetRegistry([
		{
			id: 'marker/bare',
			kind: 'marker',
			tags: [],
			params: {},
			hostKinds: ['ground'],
			build: () => geometry
		}
	]);
	const result = registry.buildAssetResult(
		'marker/bare',
		{ kind: 'ground', point: [0, 0, 0] },
		{},
		1
	);
	expect(result.object).toEqual(example());
	expect(Object.isFrozen(result)).toBe(true);
});

test('a wrapped build publishes frozen metadata and retains validated geometry', () => {
	const geometry = example();
	const metadata = { role: 'survey' };
	const registry = createAssetRegistry([
		{
			id: 'marker/wrapped',
			kind: 'marker',
			tags: [],
			params: {},
			hostKinds: ['ground'],
			build: () => createAssetBuild(geometry, metadata)
		}
	]);
	const result = registry.buildAssetResult(
		'marker/wrapped',
		{ kind: 'ground', point: [0, 0, 0] },
		{},
		1
	);
	expect(result.object).toBe(geometry);
	expect(result.metadata).toEqual({ role: 'survey' });
	expect(Object.isFrozen(result)).toBe(true);
	expect(Object.isFrozen(result.metadata)).toBe(true);
});
