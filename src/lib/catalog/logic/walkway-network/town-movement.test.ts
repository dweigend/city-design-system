import { edgePath } from '../movement-network';
import { expect, test } from 'bun:test';
import { surveyTownWalk, townDeck } from './index';
import type { Vec3 } from '../parametrik/types';

test('an oblique public approach docks the full ribbon width at the court floor', () => {
	const court = {
		id: 'court',
		position: [0, 0, 2] as Vec3,
		area: 256,
		polygon: [
			[-8, -8],
			[8, -8],
			[8, 8],
			[-8, 8]
		] as [number, number][],
		aprons: []
	};
	const args = [
		[['court', 'lane']],
		(id: string): Vec3 => (id === 'court' ? court.position : [25, 13, 2]),
		[court],
		() => 0,
		7
	] satisfies Parameters<typeof townDeck>;
	const { graph } = surveyTownWalk(...args);
	const dock = graph.edges.find((e) => e.from === 'court');
	expect(dock?.kind).toBe('dock');
	expect(dock?.grade).toBe(0);
	const parts = townDeck(...args);
	expect(parts.filter((p) => p.id.startsWith('court/court/step/'))).toEqual([]);
	const ramp = parts.find(
		(p) => p.kind === 'mesh' && p.id.startsWith('town-walk/') && p.id.endsWith('/ramp')
	);
	if (ramp?.kind !== 'mesh') throw Error('Missing docked ribbon');
	const contact = [0, ramp.points.length - 4]
		.map((i) => ramp.points.slice(i + 2, i + 4))
		.find((edge) => edge.every((p) => Math.abs(p[0] - 8) < 1e-7));
	if (!contact) throw Error('Ribbon end does not meet the court edge');
	expect(contact.every((p) => Math.abs(p[2] - 2) < 1e-7)).toBe(true);
	expect(Math.abs(contact[0][1] - contact[1][1])).toBeCloseTo(1.8);
});

test('each wearing surface follows the measured edge through the bend and over water', () => {
	const positions: Record<string, Vec3> = { a: [0, 0, 4], b: [20, 0, 4], c: [20, 18, 4] };
	const args = [
		[['a', 'b', 'c']],
		(id: string) => positions[id],
		[],
		() => 0,
		7,
		undefined,
		undefined,
		undefined,
		() => 0
	] satisfies Parameters<typeof townDeck>;
	const { graph } = surveyTownWalk(...args);
	const ride = graph.edges.find((e) => e.kind === 'bridge');
	if (!ride) throw Error('Missing bridge');
	const ports = new Map(graph.ports.map((p) => [p.id, p]));
	const points = edgePath(ride, ports);
	expect(ride.length).toBeGreaterThan(Math.hypot(20, 18));
	const part = townDeck(...args).find((p) => p.id === ride.id + '/ramp');
	if (part?.kind !== 'mesh') throw Error('Missing bridge surface');
	expect(part.points.length).toBe(points.length * 4);
	for (const [i, p] of points.entries()) {
		const left = part.points[4 * i + 2],
			right = part.points[4 * i + 3];
		for (const axis of [0, 1, 2]) expect((left[axis] + right[axis]) / 2).toBeCloseTo(p[axis], 8);
		expect(Math.hypot(left[0] - right[0], left[1] - right[1])).toBeCloseTo(ride.width, 7);
	}
});

test('coincident streets keep independent endpoints, while repeated links share one edge', () => {
	const xy: Record<string, Vec3> = {
		west: [-6, 0, 2],
		middle: [0, 0, 2],
		north: [0, 0, 2],
		east: [0, 8, 2]
	};
	const plan = surveyTownWalk(
		[
			['west', 'middle'],
			['middle', 'west'],
			['north', 'east']
		],
		(id) => xy[id],
		[],
		() => 0,
		3
	);
	expect(plan.graph.edges).toHaveLength(2);
	expect(new Set(plan.graph.edges.flatMap((e) => [e.from, e.to])).size).toBe(4);
});

test('a restricted tunnel egress docks a stair when the gentler descent cannot fit', () => {
	const make = (x: number, z: number): Vec3 => [x, 0, z];
	const court = {
		id: 'c',
		position: make(0, 2),
		area: 256,
		polygon: [
			[-8, -8],
			[8, -8],
			[8, 8],
			[-8, 8]
		] as [number, number][],
		passages: [
			{
				id: 'portal',
				entry: { position: make(19, 2), outward: [-1, 0] as const },
				exit: { position: make(30, 2), outward: [1, 0] as const },
				centreline: [make(19, 2), make(30, 2)],
				clearWidth: 3,
				headroom: 3,
				clearApproach: (_: Vec3, b: Vec3) => b[0] <= 43
			}
		]
	};
	const plan = surveyTownWalk(
		[['c', 'road']],
		(id) => (id === 'c' ? court.position : make(50, 2)),
		[court],
		() => 0,
		1
	);
	const stair = plan.graph.edges.find((e) => e.kind === 'stair');
	if (!stair) throw Error('Missing egress stair');
	expect(plan.graph.edges.some((e) => e.kind === 'dock' && e.to === stair.from)).toBe(true);
	expect(plan.graph.edges.some((e) => e.kind === 'dock' && e.from === stair.to)).toBe(true);
	expect(plan.graph.edges.some((e) => e.kind === 'tunnel')).toBe(true);
});

test('a sloping bank alone does not cut a stair into the plaza', () => {
	const court = {
		id: 'plaza',
		position: [0, 0, 3] as Vec3,
		area: 400,
		polygon: [
			[-10, -10],
			[10, -10],
			[10, 10],
			[-10, 10]
		] as [number, number][],
		aprons: []
	};
	const parts = townDeck(
		[['plaza', 'street']],
		(id) => (id === 'plaza' ? court.position : [35, 0, 3]),
		[court],
		() => 0,
		3,
		(_x, y) => y * 0.15
	);
	const slab = parts.find((p) => p.id === 'court/plaza');
	if (slab?.kind !== 'prism') throw Error('Missing plaza');
	expect(slab.polygon).toEqual(court.polygon);
	expect(parts.filter((p) => p.id.includes('/seat/step/'))).toHaveLength(0);
});
