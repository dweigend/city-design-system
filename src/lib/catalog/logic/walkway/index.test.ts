// @ts-expect-error Bun provides this test API at runtime.
import { expect, test } from 'bun:test';
import { walkwayParts } from './index';
import { flowToken } from '../../data/focus';
test('a single roof has no span', () => expect(walkwayParts([[0, 0, 4]])).toEqual([]));
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
test('a bent route keeps span identities distinct', () => {
	const parts = walkwayParts(
		[
			[1, 2, 4],
			[6, 2, 4],
			[6, 8, 4]
		],
		{ id: 'route' }
	);
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
