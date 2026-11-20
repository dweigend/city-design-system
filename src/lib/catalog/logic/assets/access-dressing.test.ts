import { expect, test } from 'bun:test';
import { buildObject } from './index';

test('a longhouse has three outward-facing windows down each side', () => {
	const { geometry } = buildObject('living-capsule', 'longhouse', 17);
	const panes = geometry.filter(
		(p) => p.kind === 'ring' && p.slot === 'glass' && p.rotation === Math.PI / 2
	);
	expect(panes).toHaveLength(6);
});

test('a longhouse has one recessed pane and bezel on each end', () => {
	const { geometry } = buildObject('living-capsule', 'longhouse', 17);
	const axialRings = geometry
		.filter((p) => p.kind === 'ring')
		.filter((p) => p.rotation !== Math.PI / 2);
	expect(axialRings.filter((p) => p.slot === 'glass')).toHaveLength(2);
	for (const sign of [-1, 1]) {
		const end = axialRings.filter((p) => Math.sign(p.position[0]) === sign);
		const panes = end.filter((p) => p.slot === 'glass');
		expect(panes).toHaveLength(1);
		const [pane] = panes;
		const bezels = end.filter(
			(p) => p.slot === 'accent' && p.innerRadius > 0 && p.innerRadius < pane.radius
		);
		expect(bezels).toHaveLength(1);
		const [bezel] = bezels;
		expect(bezel.radius).toBeGreaterThan(pane.radius);
		expect(bezel.position.slice(1)).toEqual(pane.position.slice(1));
		expect(
			sign * (bezel.position[0] - pane.position[0]) + (bezel.depth - pane.depth) / 2
		).toBeCloseTo(0.14);
	}
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
