import { expect, test } from 'bun:test';
import { Valley } from './index';
import { valleyExample } from './example';

test('replays a detached, immutable valley for the same seed and settings', () => {
	const first = valleyExample();
	const other = Valley.create({ seed: 1301 });
	const replay = valleyExample();
	expect(first.course).toEqual(replay.course);
	const explicit = Valley.create({ seed: 1201, parameters: { sinuosity: 1.15 } });
	expect(explicit.parameters).toEqual(first.parameters);
	expect(explicit.course).toEqual(first.course);
	expect(first.grid).toEqual(replay.grid);
	expect(first.grid).not.toBe(replay.grid);
	expect(first.course.xy).not.toEqual(other.course.xy);
	expect(Object.isFrozen(first.parameters)).toBe(true);
	expect(Object.isFrozen(first.course.xy)).toBe(true);
	expect(Object.isFrozen(first.grid.heights)).toBe(true);
});

test('resolves sinuosity and rejects invalid seeds and unknown parameters', () => {
	for (const seed of [-1, 2 ** 32, NaN, Infinity, 0.5]) {
		expect(() => Valley.create({ seed })).toThrow('invalid-seed');
	}
	const parameters = { sinuosity: 1.217 };
	expect(Valley.create({ seed: 0, parameters }).parameters.sinuosity).toBeCloseTo(1.22);
	expect(parameters.sinuosity).toBe(1.217);
	expect(Valley.create({ seed: 2 ** 32 - 1 }).seed).toBe(2 ** 32 - 1);
});

test('samples the same height on the bed grid and its closed boundary', () => {
	const { grid, heightAt } = valleyExample();
	expect(heightAt(-1000, 1000)).toBe(grid.heights[0]);
	expect(heightAt(1000, -1000)).toBe(grid.heights[grid.heights.length - 1]);
	expect(heightAt(-987.5, 975)).toBe(grid.heights[323]);
	expect(() => heightAt(1000.01, 0)).toThrow('outside-window');
});

test('samples the same bed and water across the regional reach', () => {
	const valley = valleyExample();
	expect(valley.sampleGround(-1000, 1000)).toMatchObject({
		height: valley.grid.heights[0],
		water: valley.grid.waterHeights[0]
	});
	const channel = valley.sampleGround(1400, -3000);
	expect(Number.isFinite(channel.height)).toBe(true);
	const repeated = valleyExample().sampleGround(1400, -3000);
	expect(repeated).toEqual(channel);
	expect(() => valley.sampleGround(Infinity, 0)).toThrow(RangeError);
});

test('keeps downstream course spacing and a distinct adjustable bend', () => {
	const { course } = valleyExample();
	const { xy } = course;
	for (let offset = 2; offset < xy.length; offset += 2) {
		expect(Math.hypot(xy[offset] - xy[offset - 2], xy[offset + 1] - xy[offset - 1])).toBeCloseTo(
			6.25,
			10
		);
	}
	expect(Valley.create({ seed: 1201, parameters: { sinuosity: 1.22 } }).course.xy).not.toEqual(xy);
	expect(course.wetWidth).toBeCloseTo(course.bankfullWidth * 0.94);
});

test('reads a lower terrace frame on each side of the valley axis', () => {
	const valley = Valley.create({ seed: 1201 });
	for (const side of ['narrow', 'wide'] as const) {
		const {
			position: [x, y, z],
			downstream,
			across,
			bearing
		} = valley.lowerTerraceFrame(25, side);
		expect(z).toBe(valley.heightAt(x, y));
		expect(z - valley.sampleGround(x, y).water).toBeGreaterThan(7);
		expect(downstream).toEqual([Math.cos(bearing), Math.sin(bearing)]);
		expect(downstream[0] * across[0] + downstream[1] * across[1]).toBeCloseTo(0);
	}
	expect(valley.lowerTerraceFrame(25).across.map((value) => -value)).toEqual([
		...valley.lowerTerraceFrame(25, 'wide').across
	]);
	expect(() => valley.lowerTerraceFrame(Infinity)).toThrow(RangeError);
});
