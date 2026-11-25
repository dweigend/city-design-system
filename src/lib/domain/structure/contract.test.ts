import { describe, expect, test } from 'bun:test';
import { defaults } from '../../../config/structure';
import {
	createFrameBayObject,
	createMemberGraph,
	gravityBalanceTolerance,
	memberSections,
	portalExample,
	readMemberSection,
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
test('R15-05 unrepresentable axial demand is reported as unavailable', () => {
	const graph = createMemberGraph({
		joints: [
			{ id: 'seat', position: [0, 0, 0], support: 'pinned' },
			{ id: 'top', position: [1, 0, 1e-308], support: 'free' }
		],
		members: [{ id: 'slope', from: 'top', to: 'seat', role: 'brace', section: 'light' }]
	});
	const result = runGravity(graph, [{ joint: 'top', forceKN: 2 }]);
	expect(result.members).toEqual([
		{ id: 'slope', verticalKN: 2, axialKN: null, utilization: null }
	]);
	expect(result.reactedKN).toBe(2);
});

test('R15-05 preserves subnormal load across two exits', () => {
	const graph = createMemberGraph({
		joints: [
			{ id: 'left', position: [-1, 0, 0], support: 'pinned' },
			{ id: 'right', position: [1, 0, 0], support: 'pinned' },
			{ id: 'top', position: [0, 0, 1], support: 'free' }
		],
		members: [
			{ id: 'left', from: 'top', to: 'left', role: 'brace', section: 'light' },
			{ id: 'right', from: 'top', to: 'right', role: 'brace', section: 'light' }
		]
	});
	for (const forceKN of [Number.MIN_VALUE, 3 * Number.MIN_VALUE, 2 ** -1022 + Number.MIN_VALUE]) {
		const result = runGravity(graph, [{ joint: 'top', forceKN }]);
		expect(result.reactedKN).toBe(forceKN);
		expect(result.balanceErrorKN).toBe(0);
		expect(result.balanced).toBe(true);
	}
});

test('R15-05 preserves representable axial demand on subnormal rise and extreme section ratios', () => {
	const subnormalSlope = createMemberGraph({
		joints: [
			{ id: 'seat', position: [0, 0, 0], support: 'pinned' },
			{ id: 'top', position: [4, 0, Number.MIN_VALUE], support: 'free' }
		],
		members: [{ id: 'slope', from: 'top', to: 'seat', role: 'brace', section: 'light' }]
	});
	expect(
		runGravity(subnormalSlope, [{ joint: 'top', forceKN: Number.MIN_VALUE }]).members[0].axialKN
	).toBe(4);

	class GetterSection {
		get widthM() {
			return 0.2;
		}
		get areaM2() {
			return 1e-100;
		}
		get referenceStressKPa() {
			return 1;
		}
	}
	const extreme = createMemberGraph({
		joints: [
			{ id: 'a', position: [-1, 0, 0], support: 'pinned' },
			{ id: 'b', position: [1, 0, 0], support: 'pinned' },
			{ id: 'top', position: [0, 0, 1], support: 'free' }
		],
		members: [
			{ id: 'tiny', from: 'top', to: 'a', role: 'brace', section: 'tiny' },
			{ id: 'huge', from: 'top', to: 'b', role: 'brace', section: 'huge' }
		],
		definitions: {
			sections: {
				tiny: new GetterSection(),
				huge: { widthM: 1, areaM2: 1e300, referenceStressKPa: 1 }
			},
			referenceStressKPa: 1
		}
	});
	expect(readMemberSection(extreme, 'tiny').areaM2).toBe(1e-100);
	expect(() => readMemberSection(extreme, 'toString')).toThrow(RangeError);
	const routed = runGravity(extreme, [{ joint: 'top', forceKN: 1e300 }]);
	expect(routed.members.find(({ id }) => id === 'tiny')?.verticalKN).toBeCloseTo(1e-100, 110);
});

test('R15-06 detached structural definitions provide widths, areas, roles and reference stress', () => {
	const joints: StructuralJoint[] = [
		{ id: 'foot', position: [0, 0, 0], support: 'pinned' },
		{ id: 'head', position: [0, 0, 1], support: 'free' }
	];
	const section = { widthM: 0.4, areaM2: 0.05, referenceStressKPa: 100 };
	const graph = createMemberGraph({
		joints,
		members: [{ id: 'post', from: 'foot', to: 'head', role: 'mast', section: 'tube' }],
		definitions: { roles: ['mast'], sections: { tube: section }, referenceStressKPa: 250 }
	});
	section.areaM2 = 1;
	const frame = createFrameBayObject('mast', graph);
	expect(frame.parts[0]?.slot).toBe('mast/tube');
	expect(frame.footprint.width).toBeCloseTo(0.4);
	const load = [{ joint: 'head', forceKN: 5 }];
	expect(runGravity(graph, load).members).toEqual([
		{ id: 'post', verticalKN: 5, axialKN: 5, utilization: 1 }
	]);
	expect(runGravity(graph, [{ joint: 'head', forceKN: 10 }]).members[0].utilization).toBe(2);
	expect(runGravity(graph, load).members[0].utilization).toBe(1);
});
