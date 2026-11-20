import { expect, test } from 'bun:test';
import { buildObject } from './index';

test('a longhouse has three outward-facing windows down each side', () => {
	const { geometry } = buildObject('living-capsule', 'longhouse', 17);
	const panes = geometry.filter(
		(p) => p.kind === 'ring' && p.slot === 'glass' && p.rotation === Math.PI / 2
	);
	expect(panes).toHaveLength(6);
	const end = geometry.filter((p) => p.kind === 'ring' && !p.rotation);
	expect(end.map((p) => p.slot)).toEqual(['accent', 'glass']);
});

test('paired escalators have four continuous glazed cheeks', () => {
	const { geometry } = buildObject('escalator', 'paired', 17);
	expect(geometry.filter((p) => p.slot === 'glass' && p.kind === 'mesh')).toHaveLength(4);
});
