import { expect, test } from 'bun:test';
import { carrierProbe } from './carrier-probe';
import { position } from './installation-parts';
import { createWorld } from './index';

test('a transverse tie between faces on the same roof uses its full length', () => {
	const { grid } = createWorld(7);
	const foot = { cellId: '83/47', level: 1, face: 0, lift: 0 };
	const top = { ...foot, face: 2, lift: 15 };
	const result = carrierProbe(
		grid,
		[{ kind: 'segment', recipe: 'brace', anchor: foot, end: top }],
		[]
	);
	expect(result).toEqual({
		failure: { reason: 'member-too-long', marks: [[position(grid, foot), position(grid, top)]] }
	});
});
