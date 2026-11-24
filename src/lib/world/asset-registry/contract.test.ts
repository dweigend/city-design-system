import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { bounds } from '../../core/object';
import { createCellSpace, parcelEdgeId, type Parcel } from '../../domain/cell-space';
import {
	buildAsset,
	InvalidAssetParamsError,
	listAssets,
	readAsset,
	UnknownAssetError,
	WrongAssetHostError
} from './index';
import { placementsExample } from './example';

const parcel: Parcel = {
	id: 'metric-plot',
	corners: [
		{ id: 'a', position: [4, 7] },
		{ id: 'b', position: [20, 7] },
		{ id: 'c', position: [20, 23] },
		{ id: 'd', position: [4, 23] }
	],
	frontage: [parcelEdgeId('a', 'b')],
	baseZ: 3,
	storeyCount: 10
};
const host = { kind: 'parcel', parcel } as const;
const id = 'house/court-neutral';

test('lists and filters static definitions, with no mutable registration data exposed', () => {
	expect(listAssets({ kind: 'house' }).map(({ id }) => id)).toEqual([
		id,
		'house/court-memphis',
		'house/court-archigram',
		'house/court-organic'
	]);
	expect(listAssets({ kind: 'house', tags: ['court', 'neutral'] })).toEqual([readAsset(id)]);
	expect(listAssets({ kind: 'house', tags: ['court', 'missing'] })).toEqual([]);
	expect(listAssets({ kind: 'missing' })).toEqual([]);
	expect(Object.isFrozen(readAsset(id).params.height)).toBe(true);
});

test('names ID, host and parameter failures independently', () => {
	expect(() => readAsset('missing')).toThrow(UnknownAssetError);
	expect(() => buildAsset('missing', host, {}, 1)).toThrow(UnknownAssetError);
	expect(() => buildAsset(id, { kind: 'ground', point: [0, 0, 0] }, {}, 1)).toThrow(
		WrongAssetHostError
	);
	const invalidParams: unknown[] = [{ color: 1 }, { height: NaN }, { height: '1' }, null, []];
	for (const params of invalidParams) {
		expect(() => buildAsset(id, host, params as Record<string, number>, 1)).toThrow(
			InvalidAssetParamsError
		);
	}
	expect(() => buildAsset(id, host, {}, 0.5)).toThrow(InvalidAssetParamsError);
});

test('every court house builds at its defaults and every combination of bounds', () => {
	const space = { kind: 'cell-space', space: createCellSpace(parcel) } as const;
	for (const { id, params } of listAssets({ kind: 'house' })) {
		const limits = Object.entries(params).reduce<Record<string, number>[]>(
			(rows, [key, { min, max }]) =>
				rows.flatMap((row) => [
					{ ...row, [key]: min },
					{ ...row, [key]: max }
				]),
			[{}]
		);
		for (const overrides of [{}, ...limits]) {
			const object = buildAsset(id, host, overrides, 42);
			expect(object).toEqual(buildAsset(id, space, overrides, 42));
			expect(object.parts.length).toBeGreaterThan(0);
			expect(object.footprint).toEqual({ width: 16, depth: 16 });
			expect(bounds(object).min[2]).toBeLessThanOrEqual(parcel.baseZ);
			expect(object.anchors.map(({ name }) => name)).toContain('entrance');
			for (const part of object.parts) {
				expect(object.slots).toContain(part.slot);
				expect(JSON.stringify(part)).not.toMatch(
					/"(?:colou?r|material|finish|token)"|#[a-f\d]{3,8}\b|(?:rgb|hsl)a?\(/i
				);
			}
		}
	}
});

test('replays three JSON placements into identical objects', () => {
	const { records, restored, original, rebuilt } = placementsExample();
	expect(original).toHaveLength(3);
	expect(restored).toEqual(records);
	expect(rebuilt).toEqual(original);
	// Full placeable objects built from these saved addresses at e3052f71.
	expect(
		rebuilt.map((object) => createHash('sha256').update(JSON.stringify(object)).digest('hex'))
	).toEqual([
		'046f52feff90a1601e5f36ac9bd052f850531296389ba19d84fe1817d94959e2',
		'3dcca072ea9aa436c5bc5f693ebed17f4f5ba8c9997e1b008f204e9c37c43cdb',
		'0b42d644b097e2165c4d1b3351301ea2174d0fe2a9ecb1c0c9aa89f51cc8bcd7'
	]);
});
