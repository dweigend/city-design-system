import { describe, expect, test } from 'bun:test';
import { createCellSpace, parcelEdgeId } from '../../domain/cell-space';
import {
	createHouseCourt,
	createHouseObject,
	houseSlots,
	houseStyles,
	type HouseStyle
} from '../../domain/house-court';
import { example } from './example';
import { fullSurfaces } from './surfaces';
import { houseDetailOf, houseLevels, projectHouse } from './index';

const space = createCellSpace({
	id: 'plot',
	corners: [
		{ id: 'a', position: [0, 0] },
		{ id: 'b', position: [20, 0] },
		{ id: 'c', position: [20, 24] },
		{ id: 'd', position: [0, 24] }
	],
	frontage: [parcelEdgeId('a', 'b')],
	baseZ: 0,
	storeyCount: 8
});

describe('projectHouse', () => {
	test('every slot any style declares has a full surface', () => {
		for (const style of Object.values(houseStyles) as HouseStyle[])
			for (const slot of houseSlots(style, 'full'))
				expect(Object.hasOwn(fullSurfaces, slot)).toBe(true);
	});

	test('draws every style at every display level, hidden as nothing', () => {
		for (const style of Object.values(houseStyles) as HouseStyle[]) {
			const house = createHouseCourt(
				space,
				{ height: 14, width: 24, complexity: 1, seed: 2 },
				style
			);
			for (const level of Object.keys(houseLevels) as (keyof typeof houseLevels)[]) {
				const drawables = projectHouse(
					createHouseObject(space, house, houseDetailOf(level), style),
					level
				);
				if (level === 'hidden') expect(drawables).toEqual([]);
				else expect(drawables.length).toBeGreaterThan(0);
			}
		}
	});

	test('the example draws a pencil house', () => {
		expect(example().every(({ hatch }) => hatch !== undefined)).toBe(true);
	});
});
