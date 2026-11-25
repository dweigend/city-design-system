import { expect, test } from 'bun:test';
import { run as meander } from './meander';
import { run as relief } from './relief';
import { run as tributary } from './tributary';

// These fixtures protect the geometry and readouts sent to the chapter's stage.
// Module contracts cover the valley, but cannot catch a route picking the wrong layer or input.
test('meander isolates the main channel and measures a longer bend', () => {
	const low = meander('start');
	const high = meander('comparison');
	for (const sample of [low, high]) {
		expect(sample.stage.view).toBe('plan');
		expect(sample.stage.drawables).toHaveLength(1);
		const [channel] = sample.stage.drawables;
		expect(channel.shape.kind).toBe('mesh');
		if (channel.shape.kind === 'mesh') expect(channel.shape.indices.length).toBeGreaterThan(0);
		expect(channel.strokeSegments).toBeUndefined();
	}
	expect(low.args).toEqual({ seed: 1201, sinuosity: 1.04, relief: 0, runoff: 1 });
	expect(high.args).toEqual({ ...low.args, sinuosity: 1.28 });
	expect(low.metric.value).toBeCloseTo(1.032, 3);
	expect(high.metric.value).toBeCloseTo(1.255, 3);
});

test('relief shows contoured ground and uses wider intervals on steep terrain', () => {
	const low = relief('start');
	const high = relief('comparison');
	for (const sample of [low, high]) {
		expect(sample.stage.view).toBe('iso');
		expect(sample.stage.drawables.map(({ id }) => id)).toEqual(['ground', 'earth']);
		expect(sample.stage.drawables[0].terrainField?.samples.length).toBeGreaterThan(0);
	}
	expect(low.args.relief).toBe(0);
	expect(high.args).toEqual({ ...low.args, relief: 1 });
	expect(low.metric).toMatchObject({ value: 1, unit: 'm' });
	expect(high.metric).toMatchObject({ value: 5, unit: 'm' });
});

test('runoff keeps the tributary network in view and raises river discharge', () => {
	const low = tributary('start');
	const high = tributary('comparison');
	for (const sample of [low, high]) {
		expect(sample.stage.view).toBe('plan');
		const water = sample.stage.drawables.find(({ id }) => id === 'river');
		expect(water?.strokeSegments?.length).toBeGreaterThan(0);
	}
	expect(low.args).toEqual({ seed: 42, sinuosity: 1.15, relief: 1, runoff: 0.5 });
	expect(high.args).toEqual({ ...low.args, runoff: 1.5 });
	expect(low.metric.value).toBeCloseTo(1.109, 3);
	expect(high.metric.value).toBeCloseTo(3.326, 3);
});
