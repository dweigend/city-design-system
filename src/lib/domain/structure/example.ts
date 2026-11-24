import { createFrameBayObject } from './frame-object';
import { createMemberGraph, type StructuralJoint, type StructuralMember } from './graph';
import type { JointLoad } from './gravity';

/** Creates a three-bay bent with unequal downward loads for the contract example. */
export function portalExample() {
	const joints: StructuralJoint[] = [];
	const members: StructuralMember[] = [];
	const loads: JointLoad[] = [];
	for (const [i, forceKN] of [1400, 2400, 1650, 850].entries()) {
		const x = i * 6;
		const foot = `foot/${i}`;
		const roof = `roof/${i}`;
		joints.push(
			{ id: foot, position: [x, 0, 0], support: i % 2 ? 'fixed' : 'pinned' },
			{ id: roof, position: [x, 0, 7], support: 'free' }
		);
		members.push({ id: `column/${i}`, from: foot, to: roof, role: 'column', section: 'heavy' });
		if (i)
			members.push({
				id: `beam/${i}`,
				from: `roof/${i - 1}`,
				to: roof,
				role: 'beam',
				section: 'heavy'
			});
		loads.push({ joint: roof, forceKN });
	}
	return { graph: createMemberGraph({ joints, members }), loads };
}

/** Builds the fixed standalone portal and its first addressed member. */
export function example() {
	const { graph } = portalExample();
	return {
		frame: createFrameBayObject('portal', graph),
		oneMember: createFrameBayObject('one-member', graph, { memberIds: [graph.members[0].id] })
	};
}
