import { createFrameBayObject, portalExample } from './index';

/** Builds the fixed standalone portal and its first addressed member. */
export function example() {
	const { graph } = portalExample();
	return {
		frame: createFrameBayObject('portal', graph),
		oneMember: createFrameBayObject('one-member', graph, { memberIds: [graph.members[0].id] })
	};
}
