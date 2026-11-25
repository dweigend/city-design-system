import { expect, test } from 'bun:test';
import { createStripSpace, parcelEdgeId } from '../cell-space';
import { defaults } from '../../../config/house-court';
import {
	createHouseCourt,
	createHouseObject,
	houseScale,
	readHouseStyle,
	houseStyles
} from './index';

const plot = (width: number, depth: number, court = false) =>
	createStripSpace({
		id: `plot-${width}-${depth}`,
		corners: [
			{ id: 'a', position: [0, 0] },
			{ id: 'b', position: [width, 0] },
			{ id: 'c', position: [width, depth] },
			{ id: 'd', position: [0, depth] }
		],
		frontage: [parcelEdgeId('a', 'b')],
		courtEdges: court ? [parcelEdgeId('c', 'd')] : [],
		baseZ: 0,
		storeyCount: 6
	});

test('a town plot is calm, a hall large, and a calm house draws few colours', () => {
	expect(houseScale(plot(18, 12))).toBe('calm');
	expect(houseScale(plot(30, 25))).toBe('regular');
	expect(houseScale(plot(80, 60))).toBe('large');
	const space = plot(18, 12);
	expect(createHouseCourt(space, { seed: 7 }, houseStyles.memphis).scale).toBe('regular');
	expect(readHouseStyle(space, houseStyles.memphis, 7)).toBe(houseStyles.memphis);
	const style = readHouseStyle(space, houseStyles.memphis, 7, houseScale(space));
	expect(style.fill.kinds).toHaveLength(1);
	expect(style.roof.kinds).toHaveLength(1);
	expect(style.slots.body.length).toBeLessThanOrEqual(
		Math.ceil(space.cells.length / defaults.cellsPerColour)
	);
});

test('frontage cells of a calm house share one eaves line', () => {
	for (let seed = 0; seed < 8; seed += 1) {
		const space = plot(26, 12);
		const house = createHouseCourt(
			space,
			{ height: 14, complexity: 1, seed },
			houseStyles.memphis,
			{ scale: 'calm' }
		);
		const front = space.cells.filter(({ sides }) => sides.some(({ frontage }) => frontage));
		const heights = new Set(
			front.map(({ id }) => house.cells.find((cell) => cell.id === id)?.toStorey)
		);
		expect(heights.size).toBe(1);
		expect([...heights][0]).toBeGreaterThanOrEqual(4 - defaults.eavesToleranceStoreys);
	}
});

test('a house with shared court access cuts no court and anchors a court door', () => {
	const space = plot(18, 12, true);
	const house = createHouseCourt(space, { height: 10.5, seed: 2 }, houseStyles.neutral);
	expect(house.courtAccess).toBe(true);
	expect(house.cells.some(({ role }) => role === 'court')).toBe(false);
	const object = createHouseObject(space, house, 'full', houseStyles.neutral);
	expect(object.anchors.map(({ name }) => name)).toEqual(['entrance', 'court']);
});

test('a rise above a kerb opens the entrance cell and puts steps from the lane in it', () => {
	const space = plot(18, 12);
	const house = createHouseCourt(space, { height: 10.5, seed: 2 }, houseStyles.neutral, {
		entranceRiseM: 1.4,
		groundZ: -2
	});
	const door = house.cells.find(({ id }) => id === house.entrances[0][0]);
	expect(door?.fromStorey).toBe(1);
	const object = createHouseObject(space, house, 'full', houseStyles.neutral);
	expect(object.parts.some(({ id, slot }) => id.endsWith('/steps') && slot === 'stair')).toBe(true);
	expect(object.anchors.find(({ name }) => name === 'entrance')?.position[2]).toBeCloseTo(-1.4, 9);
});
