import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { formFamily } from './index';
import { cellContext } from './zellen';
import { shiftZ } from '../types';
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
