import { createFrameBayObject, createSupportedFrame, portalExample } from './index';

/** Builds the fixed standalone portal and its first addressed member. */
export function example() {
	const { graph } = portalExample();
	return {
		frame: createFrameBayObject('portal', graph),
		oneMember: createFrameBayObject('one-member', graph, { memberIds: [graph.members[0].id] })
	};
}

/** Bridges two low roofs and an intermediate terrain-founded bearing line. */
export function supportedFrameExample() {
	return createSupportedFrame({
		id: 'stock-span',
		start: [0, 0],
		end: [20, 0],
		stations: [{ id: 'middle', offsetM: 10 }],
		widthM: 4,
		deckZ: 8,
		roofs: [
			{
				id: 'roof',
				hostId: 'west',
				outline: [
					[-4, -4],
					[4, -4],
					[4, 4],
					[-4, 4]
				],
				roofZ: 5,
				foundationZ: -1
			},
			{
				id: 'roof',
				hostId: 'east',
				outline: [
					[16, -4],
					[24, -4],
					[24, 4],
					[16, 4]
				],
				roofZ: 6,
				foundationZ: -1
			}
		],
		groundAt: ([x, y]) => x / 20 + y / 10
	});
}
