// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { expect, test } from 'bun:test';
import { hash } from './index';

// Frozen u32 numerators from the legacy entry point on 895d9a2, with an exact binary denominator.
const fraction = (word: number) => word / 0x1_0000_0000;

test('hashes the first address at seed zero', () => {
	expect(hash(0, 0, 0)).toBe(fraction(0xca1bf912));
});

test('hashes the first address at the maximum u32 seed', () => {
	expect(hash(0xffff_ffff, 0, 0)).toBe(fraction(0x9f63cef2));
});

test('reads only the low 32 bits of the seed', () => {
	expect(hash(-1, 0, 0)).toBe(fraction(0x9f63cef2));
	expect(hash(0x1_0000_0000, 0, 0)).toBe(fraction(0xca1bf912));
});

test('uses the ID as part of the address', () => {
	expect(hash(19, 7, 3)).toBe(fraction(0x0e700901));
	expect(hash(19, 8, 3)).toBe(fraction(0x472456e7));
});

test('uses the channel as part of the address independently of query order', () => {
	expect(hash(19, 7, 4)).toBe(fraction(0x76000431));
	expect(hash(19, 7, 3)).toBe(fraction(0x0e700901));
	expect(hash(45, 123_456_789, 11)).toBe(fraction(0x9b87be02));
	expect(hash(19, 7, 4)).toBe(fraction(0x76000431));
});
