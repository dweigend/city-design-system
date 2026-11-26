import { createCellSpace, createStripSpace, parcelEdgeId } from '../cell-space';
import {
	createHouseOccupancy,
	createMassing,
	createMassingParts,
	createPorousMassing,
	createSetbackMassing,
	type HouseOccupancyParameters
} from './index';

export const occupancyParameters = {
	styleId: 'plain',
	tendencies: {
		rearDropRatio: 0,
		courtStepComplexityRatio: 1,
		courtStepStoreys: 0,
		jitterComplexityRatio: 1,
		jitterShareRatio: 0,
		jitterStoreys: 0,
		groundOpenRatio: 0
	},
	largeCourt: false,
	largeRoofHasFigure: false
} as const satisfies HouseOccupancyParameters;

// A raised two-storey plot where the entrance clears the ground under an occupied office.
export function example() {
	const space = createStripSpace({
		id: 'lane-plot',
		corners: [
			{ id: 'a', position: [0, 0] },
			{ id: 'b', position: [7, 0] },
			{ id: 'c', position: [7, 7] },
			{ id: 'd', position: [0, 7] }
		],
		frontage: [parcelEdgeId('a', 'b')],
		baseZ: 10,
		storeyCount: 2,
		storeyHeightsM: [4, 3],
		datumIndex: 5
	});
	return createHouseOccupancy(
		space,
		{ height: 7, width: 7, complexity: 0, seed: 7 },
		{ ...occupancyParameters, styleId: 'raised-plot' },
		{
			groundAtEntrance: ([x]) => 8 + x / 7,
			storeyProgram: (datumIndex) =>
				datumIndex === 5
					? { phase: 'retained', use: 'public' }
					: { phase: 'addition', use: 'office' }
		}
	);
}

/** A court house with four upper storeys, a cut frontage and a seeded group of upper voids. */
export function operatorsExample() {
	const space = createCellSpace({
		id: 'terraced-court',
		corners: [
			{ id: 'a', position: [0, 0] },
			{ id: 'b', position: [24, 0] },
			{ id: 'c', position: [24, 24] },
			{ id: 'd', position: [0, 24] }
		],
		frontage: [parcelEdgeId('a', 'b')],
		baseZ: 4,
		storeyCount: 5,
		datumIndex: 6
	});
	const house = createHouseOccupancy(
		space,
		{ height: 17.5, width: 32, complexity: 0, seed: 7 },
		occupancyParameters
	);
	const baseline = createMassing(house);
	const setback = createSetbackMassing(space, baseline, { startStorey: 2, depth: 1 });
	const { massing, voids } = createPorousMassing(space, setback, { ratio: 0.2 });
	return { baseline, setback, massing, voids, parts: createMassingParts(space, massing) };
}
