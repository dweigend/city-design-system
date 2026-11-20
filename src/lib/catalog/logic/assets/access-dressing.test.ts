import { expect, test } from 'bun:test';
import { buildObject } from './index';

test('a longhouse has three outward-facing windows down each side', () => {
	const { geometry } = buildObject('living-capsule', 'longhouse', 17);
	const panes = geometry.filter(
		(p) => p.kind === 'ring' && p.slot === 'glass' && p.rotation === Math.PI / 2
	);
	expect(panes).toHaveLength(6);
	const ends = geometry.filter(
		(p) => p.kind === 'ring' && p.slot === 'glass' && p.rotation !== Math.PI / 2
	);
	expect(ends).toHaveLength(2);
});

test('paired escalators have four continuous glazed cheeks', () => {
	const { geometry } = buildObject('escalator', 'paired', 17);
	expect(geometry.filter((p) => p.slot === 'glass' && p.kind === 'mesh')).toHaveLength(4);
});

test('stack pods expose a pane behind the lip on either end of the long axis', () => {
	const { geometry } = buildObject('kit-capsule-ribbon-7p5m', 'round-shoulder', 17);
	for (const sign of [-1, 1]) {
		const end = geometry.filter((p) => p.kind === 'ring' && Math.sign(p.position[0]) === sign);
		const [rim, pane] = end;
		if (rim?.kind !== 'ring' || pane?.kind !== 'ring') throw Error('Expected an end fitting');
		expect(rim.slot).toBe('edge');
		expect(pane.slot).toBe('glass');
		expect(rim.innerRadius).toBeLessThan(pane.radius);
		expect(sign * (rim.position[0] - pane.position[0]) + (rim.depth - pane.depth) / 2).toBeCloseTo(
			0.14
		);
	}
	expect(geometry.filter((p) => p.kind === 'mesh' && p.slot === 'edge')).toHaveLength(2);
});
