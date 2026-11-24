import { expect, test } from 'bun:test';
import {
	createWorldReference,
	encodeKey,
	encodePair,
	equalRefs,
	readWorldReference
} from './index';

test('round-trips opaque kinds and keys and rejects unusable versions and fields', () => {
	const address = createWorldReference('plan/1', 'sister/stop', 'x|y\n"z"');
	expect(readWorldReference(JSON.parse(JSON.stringify(address)))).toEqual(address);
	expect(readWorldReference({ ...address, v: 2 })).toBeUndefined();
	expect(readWorldReference({ ...address, world: '' })).toBeUndefined();
	expect(readWorldReference({ ...address, key: 3 })).toBeUndefined();
});

test('preserves tuple boundaries even when atoms contain delimiters', () => {
	for (const delimiter of ['|', '/', ',', '\n', '\\', '"', '(', ')']) {
		const left = ['a' + delimiter + 'b', 'c'];
		const right = ['a', 'b' + delimiter + 'c'];
		expect(encodeKey(left)).not.toBe(encodeKey(right));
		expect(JSON.parse(encodeKey(left))).toEqual(left);
		expect(JSON.parse(encodeKey(right))).toEqual(right);
	}
});

test('distinguishes atom types, normalizes zero and rejects non-finite numbers', () => {
	expect(new Set(['1', 1, null, 'null', true, 'true'].map((atom) => encodeKey([atom]))).size).toBe(
		6
	);
	expect(encodeKey([-0])).toBe(encodeKey([0]));
	for (const value of [NaN, Infinity, -Infinity]) {
		expect(() => encodeKey([value])).toThrow(RangeError);
		expect(() => encodePair([value], 'finite')).toThrow(RangeError);
	}
});

test('orders pairs by code units and distinguishes tuple endpoints from strings', () => {
	expect(encodePair('a', 'Z')).toBe('["Z","a"]');
	expect(encodePair('Z', 'a')).toBe(encodePair('a', 'Z'));
	expect(encodePair(['a', 1], ['Z', null])).toBe(encodePair(['Z', null], ['a', 1]));
	expect(encodePair('a', ['Z'])).toBe(encodePair(['Z'], 'a'));
	expect(encodePair('a', ['Z'])).not.toBe(encodePair('a', '["Z"]'));
});

test('compares references by their opaque address and retains the save field order', () => {
	const address = createWorldReference('plan', 'corner', 'a|b');
	expect(JSON.stringify(address)).toBe('{"v":1,"world":"plan","kind":"corner","key":"a|b"}');
	expect(Object.isFrozen(address)).toBe(true);
	expect(equalRefs(address, createWorldReference('plan', 'corner', 'a|b'))).toBe(true);
	expect(equalRefs(address, createWorldReference('other', 'corner', 'a|b'))).toBe(false);
	expect(equalRefs(address, createWorldReference('plan', 'edge', 'a|b'))).toBe(false);
	expect(equalRefs(address, createWorldReference('plan', 'corner', 'b|a'))).toBe(false);
	expect(() => createWorldReference('plan', 'corner', '')).toThrow(RangeError);
});
