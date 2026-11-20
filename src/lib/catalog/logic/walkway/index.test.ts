import type { Vec3 } from '../parametrik/types';
import { sweepProfile } from '../linear-path';
import { expect, test } from 'bun:test';
import { walkwayParts } from './index';
import { flowToken } from '../../data/focus';
test('a single roof has no span', () => expect(walkwayParts([[0, 0, 4]])).toEqual([]));
test('walkway width is bounded in both input forms', () => {
	for (const width of [0.5, 10]) {
		expect(walkwayParts([], { width })).toEqual([]);
		expect(walkwayParts([], undefined, { width })).toEqual([]);
	}
	for (const width of [0.49, 10.1, 1e300]) {
		expect(() => walkwayParts([], { width })).toThrow(RangeError);
		expect(() => walkwayParts([], undefined, { width })).toThrow(RangeError);
	}
});

test('a level span has a people deck, two handrails and a pier', () => {
	const parts = walkwayParts([
		[0, 0, 4],
		[10, 0, 4]
	]);
	expect(parts.map((p) => p.kind)).toEqual(['prism', 'polyline', 'polyline', 'cylinder']);
	expect(parts[0]).toMatchObject({ token: flowToken.people, z: 3.75, height: 0.25 });
});
test('a descending stair meets both roof heights', () => {
	const treads = walkwayParts([
		[0, 0, 5],
		[6, 0, 4]
	]).filter((p) => p.kind === 'prism');
	expect(treads.length).toBeGreaterThan(2);
	expect(treads[0].z + 0.25).toBe(5);
	expect(treads[treads.length - 1].z + 0.25).toBe(4);
});
test('a bent route joins both rails and keeps span identities distinct', () => {
	const parts = walkwayParts(
		[
			[1, 2, 4],
			[6, 2, 4],
			[6, 8, 4]
		],
		{ id: 'route' }
	);
	const rails = parts.filter((p) => p.kind === 'polyline');
	expect(rails).toHaveLength(2);
	for (const rail of rails) expect(rail.points).toHaveLength(3);
	expect(rails[0].points[1]).toEqual([7.1, 0.8999999999999999, 5]);
	expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length);
	expect(parts.every((p) => p.id.startsWith('route:'))).toBe(true);
});
test('vertical runs have no horizontal space for treads', () =>
	expect(() =>
		walkwayParts([
			[0, 0, 4],
			[0, 0, 5]
		])
	).toThrow(RangeError));

test('sampled profiles follow sloping, vertical and horizontal 3D paths at their authored radius', () => {
	const section = [
		[0.2, 0],
		[0, 0.2],
		[-0.2, 0],
		[0, -0.2]
	] as const;
	for (const path of [
		[
			[0, 0, 0],
			[0, 0, 3]
		],
		[
			[0, 0, 0],
			[1, 0, 0],
			[2, 1, 0.4]
		],
		[
			[0, 0, 2],
			[2, 0, 0]
		]
	] satisfies Vec3[][]) {
		const { points, triangles } = sweepProfile(path, section);
		expect(triangles.length).toBe((path.length - 1) * 24);
		for (const [i, p] of points.entries()) {
			const center = path[Math.floor(i / 4)];
			expect(Math.hypot(...p.map((v, k) => v - center[k]))).toBeCloseTo(0.2, 10);
		}
	}
});
