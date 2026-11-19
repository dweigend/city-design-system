import { strict as assert } from 'node:assert';
// @ts-expect-error Bun provides its test API at runtime.
import { expect, test } from 'bun:test';
import { buildRoofFrame, dockModule, routeSlope, moduleBridge, type RoofCell } from './index';
const roofs: RoofCell[] = [0, 8, 16].map((x, i) => ({
	id: String(i),
	height: 4 + i,
	polygon: [
		[x, 0],
		[x + 6, 0],
		[x + 5, 5],
		[x, 4]
	]
}));
test('three irregular roofs share a solved frame with bearings on their walls', () => {
	const result = buildRoofFrame(roofs);
	assert.equal(result.status, 'assembled');
	const { frame } = result;
	expect(frame.analysis.status).toBe('ok');
	expect(frame.structure.lager.length).toBeGreaterThanOrEqual(9);
	expect(buildRoofFrame([...roofs].reverse())).toEqual(result);
	expect(buildRoofFrame(roofs, { maxSpan: 2 }).status).toBe('no-local-bay');
});
test('an occupied facade socket refuses a second module', () => {
	const socket = { point: [0, 0, 3], normal: [0, -1, 0], tangent: [1, 0, 0] } as const;
	const first = dockModule('capsule', socket, []);
	expect(first).toBeDefined();
	if (first) expect(dockModule('tank', socket, [first.bounds])).toBeUndefined();
});
test('a surveyed detour replaces an over-grade shortcut', () => {
	const graph = {
		points: [
			[0, 0, 0],
			[5, 5, 2],
			[0, 6, 4]
		],
		links: [
			[0, 2],
			[0, 1],
			[1, 2]
		]
	} as const;
	const route = routeSlope(graph, 0, 2, { maxGrade: 0.6 });
	expect(route?.nodes).toEqual([0, 1, 2]);
	expect(routeSlope(graph, 0, 2, { maxGrade: 0.1 })).toBeUndefined();
});
test('unequal door heights produce level bridge treads and two rails', () => {
	const parts = moduleBridge([0, 0, 4], [5, 1, 5]);
	expect(parts.some((p) => p.kind === 'prism')).toBe(true);
	expect(parts.filter((p) => p.kind === 'polyline')).toHaveLength(2);
});
