import { expect, test } from 'bun:test';
import { nextSeed, random } from './index';

// Frozen u32 numerators from the legacy entry point on 895d9a2, with an exact binary denominator.
const fraction = (word: number) => word / 0x1_0000_0000;

test('continues the frozen sequence from seed zero', () => {
	const draw = random(0);
	expect([draw(), draw(), draw(), draw()]).toEqual(
		[0x4434b462, 0x00159c37, 0x39285b08, 0x256d8104].map(fraction)
	);
});

test('continues the frozen sequence from the maximum u32 seed', () => {
	const draw = random(0xffff_ffff);
	expect([draw(), draw(), draw(), draw()]).toEqual(
		[0xe57bf3d3, 0x3081a5a4, 0xb7350390, 0xf1ade904].map(fraction)
	);
});

test('preserves the draw order for Bible reference seeds', () => {
	for (const [seed, first, second, third] of [
		[1, 0xa087eaf3, 0x00b349c9, 0x8706c4eb],
		[19, 0x0efcc103, 0x53aef26a, 0x73d81d8c],
		[45, 0x0985a509, 0xe9eeaa6d, 0xc963a518]
	]) {
		const draw = random(seed);
		expect([draw(), draw(), draw()]).toEqual([first, second, third].map(fraction));
	}
});

test('normalizes the seed and keeps interleaved generators independent', () => {
	const first = random(-1);
	const second = random(0xffff_ffff);
	expect(first()).toBe(fraction(0xe57bf3d3));
	expect(first()).toBe(fraction(0x3081a5a4));
	expect(second()).toBe(fraction(0xe57bf3d3));
	expect(first()).toBe(fraction(0xb7350390));
	expect(second()).toBe(fraction(0x3081a5a4));
});

test('derives each reroll seed from the first draw of a fresh sequence', () => {
	const reroll = nextSeed(0);
	expect(reroll).toBe(0x4434b462);
	expect(nextSeed(reroll)).toBe(3_078_035_022);
	expect(nextSeed(0xffff_ffff)).toBe(0xe57bf3d3);
});
