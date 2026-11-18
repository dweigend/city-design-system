import { test } from 'node:test';
import assert from 'node:assert/strict';
import init from 'manifold-3d';
import { buildEnvelope, roundFootprint, type BuildingCell } from './index';
const kernel = await init();
kernel.setup();
const square: BuildingCell = {
	polygon: [
		[0, 0],
		[8, 0],
		[8, 8],
		[0, 8]
	],
	roof: 'gable'
};
const mesh = (...cells: BuildingCell[]) => buildEnvelope(kernel, cells);
test('eight-metre gable has a centred ridge four metres above its eaves', () => {
	const { positions } = mesh({ ...square, params: { pitch: Math.PI / 4 } });
	assert.equal(Math.max(...positions.filter((_, i) => i % 3 === 2)), 7);
});
test('a collapsed cell produces an empty shell', () => {
	assert.equal(
		mesh({
			...square,
			polygon: [
				[0, 0],
				[1, 0],
				[2, 0]
			]
		}).indices.length,
		0
	);
});
test('an overhang extends past the ground floor', () => {
	assert.equal(
		Math.min(
			...mesh({ ...square, storeys: [{}, { offset: 1 }] }).positions.filter((_, i) => i % 3 === 0)
		),
		-1
	);
});
test('oversize corner radii stay inside a square', () => {
	const points = roundFootprint(square.polygon, 100);
	assert.ok(points.length > 4);
	assert.equal(
		points.flat().every((n) => n >= -1e-7 && n <= 8 + 1e-7),
		true
	);
});
test('two touching sheds lose the interior party wall', () => {
	const { positions, indices } = mesh(
		{ ...square, roof: 'shed' },
		{
			...square,
			roof: 'shed',
			polygon: [
				[8, 0],
				[16, 0],
				[16, 8],
				[8, 8]
			]
		}
	);
	for (let i = 0; i < indices.length; i += 3) {
		assert.equal(
			[0, 1, 2].every((j) => positions[indices[i + j] * 3] === 8),
			false
		);
	}
});
