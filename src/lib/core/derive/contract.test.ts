import { expect, test } from 'bun:test';
import { example } from './example';
import { createDeriveCache } from './index';

test('keeps derived values by identity within a scope, key and revision', () => {
	const read = createDeriveCache<object, object>();
	const first = {};
	const second = {};
	const initial = read(first, ['grid', 42], ['terrain', 0], () => ({}));
	expect(read(first, ['grid', '42'], ['terrain', 0], () => ({}))).not.toBe(initial);
	expect(read(second, ['grid', 42], ['terrain', 0], () => ({}))).not.toBe(initial);
	expect(read(first, ['grid', 42], ['terrain', 0], () => ({}))).toBe(initial);
	expect(read(first, ['grid', 42], '["terrain",0]', () => ({}))).not.toBe(initial);
	expect(example()).toEqual([0, 35, 0]);
});

test('keeps undefined results and retains the last revision after a failed read', () => {
	const read = createDeriveCache<object, undefined>();
	const site = {};
	const failure = () => {
		throw new Error('Cannot derive');
	};
	read(site, [], '0', () => undefined);
	expect(() => read(site, [], '1', failure)).toThrow('Cannot derive');
	expect(read(site, [], '0', failure)).toBeUndefined();
});

test('bounds independent keys per scope in insertion order when asked', () => {
	const read = createDeriveCache<object, number>(2);
	const site = {};
	read(site, ['a'], '', () => 1);
	read(site, ['b'], '', () => 2);
	expect(read(site, ['a'], '', () => 9)).toBe(1);
	read(site, ['c'], '', () => 3);
	expect(read(site, ['b'], '', () => 9)).toBe(2);
	expect(read(site, ['a'], '', () => 9)).toBe(9);
	expect(() => createDeriveCache(0)).toThrow(RangeError);
});
