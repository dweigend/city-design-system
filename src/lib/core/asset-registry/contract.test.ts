import { expect, test } from 'bun:test';
import { createAssetRegistry, type AssetEntry } from './index';
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
