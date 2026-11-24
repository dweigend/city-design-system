import { describe, expect, test } from 'bun:test';
import { defaults } from '../../../config/structure';
import {
	createMemberGraph,
	gravityBalanceTolerance,
	memberSections,
	portalExample,
	runGravity,
	type StructuralJoint,
	type StructuralMember
} from './index';

describe('member graph', () => {
	const { graph, loads } = portalExample();

	test('rejects duplicate joint and member IDs', () => {
		expect(() =>
			createMemberGraph({ ...graph, joints: [...graph.joints, graph.joints[0]] })
		).toThrow('Duplicate joint ID "foot/0"');
		expect(() =>
			createMemberGraph({ ...graph, members: [...graph.members, graph.members[0]] })
		).toThrow('Duplicate member ID "beam/1"');
	});

	test('rejects dangling and coincident endpoints', () => {
		const member = graph.members[0];
		expect(() => createMemberGraph({ ...graph, members: [{ ...member, to: 'missing' }] })).toThrow(
			'Dangling member "beam/1"'
		);
		const joints = graph.joints.map((joint) =>
			joint.id === member.to ? { ...joint, position: [0, 0, 7] as const } : joint
		);
		expect(() => createMemberGraph({ joints, members: [member] })).toThrow(
			'Zero-length member "beam/1"'
		);
	});

	test('rejects malformed positions and section keys with named errors', () => {
		const joint = graph.joints[0];
		const member = graph.members[0];
		for (const value of [undefined, null, { 0: 0, 1: 0, 2: 0, length: 3 }, Array<number>(3)]) {
			const position = value as unknown as StructuralJoint['position'];
			expect(() =>
				createMemberGraph({
					...graph,
					joints: [{ ...joint, position }, ...graph.joints.slice(1)]
				})
			).toThrow(new RangeError('Invalid position at joint "foot/0"'));
		}
		const section = ['light'] as unknown as StructuralMember['section'];
		expect(() =>
			createMemberGraph({
				...graph,
				members: [{ ...member, section }]
			})
		).toThrow(new RangeError('Unknown section at member "beam/1"'));
	});

	test('keeps validated input detached when the caller edits its records', () => {
		const position: [number, number, number] = [0, 0, 0];
		const joint = { ...graph.joints[0], position };
		const member = { ...graph.members[0] };
		const copy = createMemberGraph({
			...graph,
			joints: [joint, ...graph.joints.slice(1)],
			members: [member]
		});
		position[0] = 18;
		member.section = 'light';
		expect(copy.joints[0].position).toEqual([0, 0, 0]);
		expect(Object.isFrozen(copy.joints[0].position)).toBe(true);
		expect(copy.members[0].section).toBe('heavy');
	});

	test('balances the standalone portal and reroutes a removed column across its beam', () => {
		const full = runGravity(graph, loads);
		expect(full.status).toBe('routed');
		expect(full.reactions).toEqual(
			loads.map(({ joint, forceKN }) => ({ joint: joint.replace('roof', 'foot'), forceKN }))
		);
		const altered = createMemberGraph({
			...graph,
			members: graph.members.filter(({ id }) => id !== 'column/0')
		});
		const result = runGravity(altered, loads);
		expect(result.status).toBe('routed');
		expect(result.reactions[0].forceKN).toBe(0);
		expect(result.reactions[1].forceKN).toBe(3800);
		expect(result.members.find(({ id }) => id === 'beam/1')).toEqual({
			id: 'beam/1',
			verticalKN: 1400,
			axialKN: null,
			utilization: null
		});
		expect(Math.abs(result.appliedKN - result.reactedKN)).toBeLessThan(
			result.appliedKN * gravityBalanceTolerance
		);
	});

	test('splits by metal area and converts inclined transfer to axial demand', () => {
		const frame = createMemberGraph({
			joints: [
				{ id: 'left', position: [0, 0, 0], support: 'pinned' },
				{ id: 'middle', position: [0, 0, 4], support: 'free' },
				{ id: 'right', position: [3, 0, 0], support: 'fixed' }
			],
			members: [
				{ id: 'column', from: 'left', to: 'middle', role: 'column', section: 'heavy' },
				{ id: 'brace', from: 'middle', to: 'right', role: 'brace', section: 'light' }
			]
		});
		const result = runGravity(frame, [{ joint: 'middle', forceKN: 800 }]);
		const { heavy, light } = memberSections;
		const right = (800 * light.areaM2) / (heavy.areaM2 + light.areaM2);
		expect(result.reactions.map(({ joint }) => joint)).toEqual(['left', 'right']);
		expect(result.reactions[0].forceKN).toBeCloseTo(800 - right);
		expect(result.reactions[1].forceKN).toBeCloseTo(right);
		const axial = (right * 5) / 4;
		expect(result.members[0].axialKN).toBeCloseTo(axial);
		expect(result.members[0].utilization).toBeCloseTo(
			axial / (light.areaM2 * defaults.nominalStressKPa)
		);
	});

	test('reports a detached assembly without charging its members', () => {
		const disconnected = createMemberGraph({
			...graph,
			members: graph.members.filter(({ role }) => role === 'beam')
		});
		const result = runGravity(disconnected, loads);
		expect(result.status).toBe('unrouted');
		expect(result.unsupported).toEqual(loads.map(({ joint }) => joint));
		expect(result.unreactedKN).toBe(result.appliedKN);
		expect(result.reactedKN).toBe(0);
		expect(result.balanced).toBe(true);
		expect(result.members.every(({ verticalKN }) => verticalKN === 0)).toBe(true);
	});

	test('avoids a descending dead end even when it is lower than a supported route', () => {
		const foot = { id: 'dead', position: [1, 0, 1] as const, support: 'free' as const };
		const withDeadEnd = createMemberGraph({
			joints: [...graph.joints, foot],
			members: [
				...graph.members,
				{ id: 'dead-end', from: 'roof/0', to: foot.id, role: 'brace', section: 'heavy' }
			]
		});
		const result = runGravity(withDeadEnd, loads);
		expect(result.unsupported).toEqual([foot.id]);
		expect(result.members.find(({ id }) => id === 'dead-end')?.verticalKN).toBe(0);
		expect(result.reactedKN).toBe(result.appliedKN);
	});

	test('is exactly invariant under list and endpoint permutation', () => {
		const permuted = createMemberGraph({
			joints: [...graph.joints].reverse(),
			members: [...graph.members]
				.reverse()
				.map(({ from, to, ...member }) => ({ ...member, from: to, to: from }))
		});
		expect(runGravity(permuted, [...loads].reverse())).toEqual(runGravity(graph, loads));
	});
});
