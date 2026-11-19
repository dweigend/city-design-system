import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { formFamily } from './index';
import { cellContext } from './zellen';
import { shiftZ } from '../types';
import { translate } from '../../ansicht/geometrie';
import { scaleForm } from '../komposition/height';

test('explicit polygon struts are projected together; moving and scaling keeps connections', () => {
	const f = formFamily('rahmen-plugin');
	assert.ok(f);
	const frame = f.generate(cellContext('triangle', 7), {}).find((p) => p.kind === 'frame');
	assert.ok(frame?.kind === 'frame' && frame.members?.length);
	const scaled = scaleForm([shiftZ(frame, 3)], [0, 0, 0], 2)[0];
	assert.ok(scaled.kind === 'frame' && scaled.members);
	for (let i = 0; i < frame.members.length; i++)
		for (let j = 0; j < 2; j++)
			assert.deepEqual(
				scaled.members[i][j],
				frame.members[i][j].map((v, k) => (v + (k === 2 ? 3 : 0)) * 2)
			);
});

test('scaling moves frame bearings and member endpoints about the same center', () => {
	const frame = formFamily('rahmen-plugin')
		?.generate(cellContext('triangle', 7), {})
		.find((p) => p.kind === 'frame');
	assert.ok(frame?.kind === 'frame' && frame.members?.length);
	const [foot] = frame.members[0];
	const scaled = scaleForm([{ ...frame, bearings: [foot] }], [1, 2, 3], 2)[0];
	assert.ok(scaled.kind === 'frame' && scaled.members);
	assert.deepEqual(scaled.bearings, [[2 * foot[0] - 1, 2 * foot[1] - 2, 2 * foot[2] - 3]]);
	assert.deepEqual(scaled.bearings?.[0], scaled.members[0][0]);
});

test('translation moves explicit frame members and their bearings together', () => {
	const frame = formFamily('rahmen-plugin')
		?.generate(cellContext('triangle', 7), {})
		.find((p) => p.kind === 'frame');
	assert.ok(frame?.kind === 'frame' && frame.members?.length);
	const [foot] = frame.members[0];
	const moved = translate({ ...frame, bearings: [foot] }, [1, 2, 3]);
	assert.ok(moved.kind === 'frame' && moved.members);
	assert.deepEqual(moved.bearings, [[foot[0] + 1, foot[1] + 2, foot[2] + 3]]);
	assert.deepEqual(moved.bearings?.[0], moved.members[0][0]);
});
