import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { drainageExample, regionalDrainageExample } from './drainage-example';
import { surveyValley, Valley } from './index';
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

test('derives the adjustable trunk from reaches and scales width by runoff', () => {
	const { course, reaches } = valleyExample();
	expect(Valley.create({ seed: 1201, parameters: { sinuosity: 1.22 } }).course.xy).not.toEqual(
		course.xy
	);
	const wetter = Valley.create({ seed: 1201, parameters: { runoff: 1.5 } });
	expect(wetter.course.xy).toEqual(course.xy);
	expect(wetter.course.wetWidth / course.wetWidth).toBeCloseTo(1.5 ** 0.34, 10);
	expect(reaches.some(({ trunk }) => trunk)).toBe(true);
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

test('versions the result and exposes frozen drainage geometry and terrain reads', () => {
	const valley = Valley.create({ seed: 42, parameters: { relief: 1 } });
	expect(valley.revision).toBe(4);
	expect(valley.parameters).toEqual({ sinuosity: 1.15, relief: 1, runoff: 1 });
	const hash = (value: Valley) =>
		Bun.hash(JSON.stringify([value.reaches, value.lakes, value.grid]));
	expect(hash(Valley.create({ seed: 42, parameters: { relief: 1 } }))).toBe(hash(valley));
	const lowland = surveyValley(valleyExample());
	expect(surveyValley(valley).reliefM).toBeGreaterThan(lowland.reliefM * 3);
	const reach = valley.reaches.find(({ trunk }) => trunk);
	if (!reach) throw new Error('Expected an imported channel');
	const sample = valley.readGround(...reach.stations[0].xy);
	expect(sample).toMatchObject({ cover: 'river', waterKind: 'river' });
	expect(Object.isFrozen(sample)).toBe(true);
	expect(Object.isFrozen(reach.stations)).toBe(true);
	expect(valley.checkDrainage().carvedSillFaults).toBe(0);
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

test('routes higher and lower lakes in series at their separate spill levels', () => {
	const flow = drainageExample([
		[20, 20, 20, 20, 20, 20, 20],
		[20, 3, 3, 20, 20, 20, 20],
		[20, 3, 3, 20, 20, 20, 20],
		[20, 20, 8, 8, 2, 20, 20],
		[20, 20, 20, 2, 2, 5, 0],
		[20, 20, 20, 2, 2, 20, 20],
		[20, 20, 20, 20, 20, 20, 20]
	]);
	expect(flow.basins.map(({ level }) => level)).toEqual([5000, 8000]);
	const low = flow.basins[0].root;
	const chain = [];
	for (let i = flow.basins[1].root; i >= 0; i = flow.receiver[i]) chain.push(i);
	expect(chain).toContain(low);
	expect(chain.at(-1)).toBe(34);
});

test('keeps the imported flow through the regional catchment on fixed seeds', () => {
	for (const seed of [1201, 42, 9001]) {
		const terrain = regionalDrainageExample(seed);
		expect(terrain.path.length).toBeGreaterThan(100);
		expect(terrain.reaches.some(({ trunk }) => trunk)).toBe(true);
		expect(terrain.reaches.some(({ trunk }) => !trunk)).toBe(true);
		for (const { stations } of terrain.reaches) {
			for (let i = 1; i < stations.length; i++)
				expect(stations[i].water).toBeLessThanOrEqual(stations[i - 1].water);
		}
	}
});

test('checks the local water level at the shoreline on falling channels and beside a lake sill', () => {
	const valley = Valley.create({ seed: 424242, parameters: { relief: 1, runoff: 1.5 } });
	const slope = valley.readGround(1440, -1600);
	const upstream = valley.readGround(1440, -1580);
	expect(slope.waterKind).toBeNull();
	expect(upstream.waterKind).toBe('tributary');
	expect(slope.height).toBeLessThan(upstream.water);
	expect(valley.readGround(1440, -1582).height).toBeGreaterThan(71);
	expect(valley.readGround(-1054, 1340).height).toBeGreaterThan(
		valley.readGround(-1060, 1340).water
	);
	expect(surveyValley(valley).faults.shoreBelowWater).toBe(0);
});

const spillRegression = { seed: 0, parameters: { relief: 0.1, runoff: 1.5, sinuosity: 1.28 } };

test('preserves lake spill elevations after incision and terrace blending', () => {
	const valley = Valley.create(spillRegression);
	expect(valley.lakes.some(({ id, level }) => id === -3 && level === 26.048)).toBe(true);
	expect(valley.checkDrainage().carvedSillFaults).toBe(0);
	for (const { outlet, level } of valley.lakes)
		expect(valley.readGround(...outlet).height).toBe(level);
});

test('triangulates the shallow lake without repeated indices or zero-area faces', () => {
	const { lakes } = Valley.create(spillRegression);
	const { vertices, indices } = required(
		lakes.find(({ id }) => id === -2),
		'shallow lake regression'
	);
	expect(indices.length).toBeGreaterThan(0);
	for (let i = 0; i < indices.length; i += 3) {
		const [a, b, c] = indices.slice(i, i + 3);
		expect(new Set([a, b, c]).size).toBe(3);
		const [[x, y], [u, v], [s, t]] = [vertices[a], vertices[b], vertices[c]];
		expect((u - x) * (t - y) - (v - y) * (s - x)).toBeGreaterThan(0);
	}
});

test('reads the wet inlet on the closed solve boundary and rejects the exterior', () => {
	const valley = Valley.create({ seed: 1201 });
	const inlet = valley.readGround(2188.315173, 6000);
	expect(inlet.waterKind).toBe('river');
	expect(inlet.bank).toBeLessThan(0);
	expect(Number.isFinite(inlet.slope)).toBe(true);
	expect(() => valley.readGround(2188.315173, 6000.001)).toThrow('outside-drainage-solve');
});
