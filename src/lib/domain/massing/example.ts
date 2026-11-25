import { createStripSpace, parcelEdgeId } from '../cell-space';
import { createHouseOccupancy } from './index';

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
		{
			styleId: 'raised-plot',
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
		},
		{
			groundAtEntrance: ([x]) => 8 + x / 7,
			storeyProgram: (datumIndex) =>
				datumIndex === 5
					? { phase: 'retained', use: 'public' }
					: { phase: 'addition', use: 'office' }
		}
	);
}
