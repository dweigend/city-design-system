import assert from 'node:assert/strict';
import { test } from 'node:test';
import init, { type Vec2 } from 'manifold-3d';
import { buildEnvelope, type Roof } from './index';
const kernel = await init();
kernel.setup();
const roofs: Roof[] = ['hip', 'gable', 'sawtooth', 'shed'];
test('changing the first survey point, winding or wall subdivisions preserves the complete mesh', () => {
	const outline: Vec2[] = [
		[0, 0],
		[12, 0],
		[9, 4],
		[4, 3],
		[0, 3]
	];
	for (const roof of roofs) {
		const build = (polygon: Vec2[]) =>
			buildEnvelope(kernel, [
				{
					polygon,
					roof,
					params: { pitch: 0.31 },
					grade: [0.02, -0.1],
					storeys: [{}, { offset: -0.2, radius: 0.25 }]
				}
			]);
		const expected = build(outline);
		const surveyed: Vec2[] = [[0, 0], [0.00000001, 0], [1, 0], [4, 0], ...outline.slice(1), [0, 1]];
		for (const ring of [surveyed, [...surveyed].reverse()]) {
			for (let i = 0; i < ring.length; i++) {
				const rotated = ring.slice(i).concat(ring.slice(0, i));
				assert.deepEqual(build([...rotated, rotated[0]]), expected);
			}
		}
	}
});
