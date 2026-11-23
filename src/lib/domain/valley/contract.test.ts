import { expect, test } from 'bun:test';
import { drainageExample } from './drainage-example';
import { peakHeightM, surveyValley, Valley } from './index';
import { valleyExample } from './example';

/** Bun hash of the seed-1201 default grid, recorded before relief and lakes existed. */
const DEFAULT_GRID_HASH = '94893e97f1f4e7f3';
const gridHash = (valley: Valley) => Bun.hash(JSON.stringify(valley.grid)).toString(16);

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

test('keeps the default lowland valley unchanged by relief and lake', () => {
	const valley = valleyExample();
	expect(valley.parameters).toEqual({ sinuosity: 1.15, relief: 0, lake: 1 });
	expect(valley.lake).toBeNull();
	expect(gridHash(valley)).toBe(DEFAULT_GRID_HASH);
	const explicit = Valley.create({ seed: 1201, parameters: { relief: 0, lake: 0 } });
	expect(explicit.grid).toEqual(valley.grid);
	for (const seed of [1201, 7, 42, 314]) {
		expect(Valley.create({ seed, parameters: { relief: 0 } }).lake).toBeNull();
	}
});

test('raises seeded mountains with relief and replays them per seed', () => {
	const ranges = [0, 0.5, 1].map(
		(relief) => surveyValley(Valley.create({ seed: 42, parameters: { relief, lake: 0 } })).reliefM
	);
	expect(ranges[0]).toBeLessThan(40);
	expect(ranges[1]).toBeGreaterThan(4 * ranges[0]);
	expect(ranges[2]).toBeGreaterThan(1.5 * ranges[1]);
	expect(peakHeightM(1)).toBeGreaterThan(ranges[1]);
	const first = Valley.create({ seed: 7, parameters: { relief: 1 } });
	expect(gridHash(Valley.create({ seed: 7, parameters: { relief: 1 } }))).toBe(gridHash(first));
	expect(gridHash(Valley.create({ seed: 8, parameters: { relief: 1 } }))).not.toBe(gridHash(first));
});

test('holds a forced lake flat; the river enters and leaves at its level', () => {
	for (const [seed, relief] of [
		[1201, 0],
		[42, 0.6],
		[9001, 1]
	]) {
		const valley = Valley.create({ seed, parameters: { relief, lake: 2 } });
		const lake = valley.lake;
		if (!lake) throw new Error('Expected a forced lake');
		const survey = surveyValley(valley);
		expect(survey.faults).toEqual({ uphillSteps: 0, lakeTiltM: 0, dryBelowWater: 0 });
		expect(survey.lakeArea).toBeGreaterThan(0.5 * lake.area);
		const center = valley.readGround(...lake.center);
		expect(center).toMatchObject({ cover: 'lake', water: lake.level });
		expect(center.water - center.height).toBeGreaterThan(lake.depth * 0.9);
		const c = Math.cos(lake.bearing);
		const s = Math.sin(lake.bearing);
		for (const sign of [-1, 1]) {
			const tip = lake.halfLength - 1;
			const [x, y] = [lake.center[0] + sign * c * tip, lake.center[1] + sign * s * tip];
			expect(valley.sampleGround(x, y).water).toBe(lake.level);
		}
	}
});

test('draws seeded lakes only where relief makes a basin', () => {
	const seeds = Array.from({ length: 16 }, (_, index) => 100 + index);
	const lakes = (relief: number, lake: number) =>
		seeds.filter((seed) => Valley.create({ seed, parameters: { relief, lake } }).lake).length;
	expect(lakes(1, 1)).toBeGreaterThan(3);
	expect(lakes(1, 1)).toBeLessThan(seeds.length);
	expect(lakes(1, 0)).toBe(0);
	expect(lakes(0, 2)).toBe(seeds.length);
});

test('reads height, slope, wet or dry and water kind at any point', () => {
	const valley = Valley.create({ seed: 42, parameters: { relief: 1, lake: 2 } });
	const covers = new Set<string>();
	let steepest = 0;
	for (let x = -2000; x <= 2000; x += 100) {
		for (let y = -2000; y <= 2000; y += 100) {
			const reading = valley.readGround(x, y);
			expect(reading.height).toBe(valley.sampleGround(x, y).height);
			expect(reading.cover === 'dry').toBe(reading.bank > 0);
			covers.add(reading.cover);
			steepest = Math.max(steepest, reading.slope);
		}
	}
	expect([...covers].sort()).toEqual(['dry', 'lake', 'river']);
	expect(steepest).toBeGreaterThan(0.5);
	expect(Object.isFrozen(valley.readGround(0, 0))).toBe(true);
	expect(() => valley.readGround(NaN, 0)).toThrow(RangeError);
});

test('combines a fork downstream and accounts for all rain and imported area', () => {
	const flow = drainageExample(
		[
			[9, 9, 9, 9, 9],
			[9, 5, 9, 9, 9],
			[9, 9, 3, 5, 9],
			[9, 9, 1, 9, 9],
			[9, 9, 0, 9, 9]
		],
		6,
		100_000
	);
	expect(flow.receiver[6]).toBe(12);
	expect(flow.receiver[13]).toBe(12);
	expect(flow.area[12]).toBe(
		flow.area.reduce((sum, area, i) => sum + (flow.receiver[i] === 12 ? area : 0), 10_000)
	);
	const outlets = flow.area.filter((_, i) => flow.receiver[i] < 0);
	expect(outlets.reduce((sum, area) => sum + area, 0)).toBeCloseTo(260_000, 7);
});

test('routes flats toward an earlier flood parent with deterministic ties', () => {
	const flow = drainageExample([
		[3, 1, 3, 1],
		[3, 1, 1, 3],
		[3, 1, 1, 3],
		[3, 3, 3, 3]
	]);
	for (const [index, next] of flow.receiver.entries()) {
		if (next < 0) continue;
		expect(flow.level[next]).toBeLessThanOrEqual(flow.level[index]);
		expect(flow.order.indexOf(next)).toBeLessThan(flow.order.indexOf(index));
	}
	expect(flow.receiver[5]).toBe(1);
});

test('contracts both arms of a side basin at one known sill', () => {
	const flow = drainageExample([
		[9, 9, 9, 9, 9, 9],
		[9, 1, 9, 2, 9, 9],
		[9, 2, 2, 2, 4, 0],
		[9, 9, 9, 9, 9, 9],
		[9, 9, 9, 9, 9, 9],
		[9, 9, 9, 9, 9, 9]
	]);
	expect(flow.basins).toHaveLength(1);
	expect(flow.basins[0]).toMatchObject({ level: 4000, outlet: 16, depth: 3000 });
	expect(flow.membership[7]).toBe(flow.membership[9]);
	expect(flow.bed[16]).toBe(4000);
	expect(flow.receiver[16]).toBe(17);
});
