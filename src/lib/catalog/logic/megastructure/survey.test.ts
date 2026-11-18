import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildRoofFrame, dockModule, type RoofCell } from './index';
import type { Vec3 } from '../traeger';
const rect: RoofCell = {
	id: 'a',
	height: 4,
	polygon: [
		[0, 0],
		[10, 0],
		[10, 4],
		[0, 4]
	]
};
test('every obstacle is validated before a socket is declared occupied', () => {
	const socket = { point: [0, 0, 0], normal: [0, 0, 1], tangent: [1, 0, 0] } as const;
	const segment = { a: [0, 0, -1] satisfies Vec3, b: [0, 0, 3] satisfies Vec3, radius: 0 };
	const bad: Parameters<typeof dockModule>[2] = [
		{ ...segment, radius: NaN },
		{ ...segment, radius: -2 },
		{ ...segment, a: [0, Infinity, 0] },
		{ ...segment, b: [0, 0, NaN] },
		{ min: [NaN, -1, 0], max: [1, 1, 2] },
		{ min: [2, 0, 0], max: [1, 1, 2] }
	];
	assert.equal(dockModule('capsule', socket, [segment]), undefined);
	for (const obstacle of bad)
		assert.throws(() => dockModule('capsule', socket, [segment, obstacle]), RangeError);
});
test('crossed, concave and zero-edge rings are invalid before solving', () => {
	const rings: RoofCell['polygon'][] = [
		[
			[0, 0],
			[5, 4],
			[0, 4],
			[4, 0]
		],
		[
			[0, 0],
			[5, 0],
			[1, 2],
			[5, 4],
			[0, 4]
		],
		[
			[0, 0],
			[5, 0],
			[5, 0],
			[0, 4]
		]
	];
	for (const polygon of rings) assert.throws(() => buildRoofFrame([{ ...rect, polygon }]));
});
test('roof interiors cannot overlap even at different elevations; a shared wall is allowed', () => {
	const second = { ...rect, id: 'b', height: 6 };
	const rings: RoofCell['polygon'][] = [
		rect.polygon,
		[
			[1, 1],
			[4, 1],
			[4, 2],
			[1, 2]
		],
		[
			[-1, 1],
			[11, 1],
			[11, 3],
			[-1, 3]
		]
	];
	for (const polygon of rings)
		assert.throws(() => buildRoofFrame([rect, { ...second, polygon }]), /Overlapping/);
	const adjacent = rect.polygon.map(([x, y]): [number, number] => [x, y + 4]).reverse();
	const result = buildRoofFrame([rect, { ...second, polygon: adjacent }]);
	assert.equal(result.status, 'assembled');
	assert.equal(result.frame.analysis.status, 'ok');
});
test('ten subdivisions of one wall preserve the entire structural result', () => {
	const polygon: RoofCell['polygon'] = [
		...Array.from({ length: 11 }, (_, x): [number, number] => [x, 0]),
		[10, 4],
		[0, 4]
	];
	assert.deepEqual(buildRoofFrame([{ ...rect, polygon }]), buildRoofFrame([rect]));
});

test('all start points and windings of subdivided walls yield the same bearings and solved frame', () => {
	const polygon: RoofCell['polygon'] = [
		[0, 0],
		[12, 0],
		[9, 4],
		[0, 3]
	];
	const expected = buildRoofFrame([{ ...rect, polygon }], { maxSpan: 7 });
	assert.equal(expected.status, 'assembled');
	assert.equal(expected.frame.analysis.status, 'ok');
	const subdivided: RoofCell['polygon'] = [
		[0, 0],
		[1, 0],
		[12, 0],
		[9, 4],
		[0, 3]
	];
	for (const outline of [polygon, subdivided]) {
		for (const ring of [outline, [...outline].reverse()]) {
			for (let i = 0; i < ring.length; i++) {
				const rotated = [...ring.slice(i), ...ring.slice(0, i)];
				assert.deepEqual(buildRoofFrame([{ ...rect, polygon: rotated }], { maxSpan: 7 }), expected);
			}
		}
	}
});
