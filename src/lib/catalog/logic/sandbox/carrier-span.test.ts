// @ts-expect-error Bun supplies the test API.
import { expect, test } from 'bun:test';
import { carrierProbe } from './carrier-probe';
import { position } from './installation-parts';
import { beginStroke, createWorld, extendStroke, installationView, type World } from './index';

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

function paint(world: World, from: string, to: string) {
	return [from, to].reduce(
		extendStroke,
		beginStroke({ kind: 'house', style: 'megastructure', use: 'material' }, world)
	);
}

test('seed 7 refuses the 16.22 m brace between 87/43 and 87/50 before committing the carrier', () => {
	const world = createWorld(7);
	const stroke = paint(world, '87/43', '87/50');
	expect(stroke.draft).toBe(world);
	expect(stroke.failure?.reason).toBe('member-too-long');
	const [a, b] = stroke.failure!.marks[0];
	const run = Math.hypot(a[0] - b[0], a[1] - b[1]);
	expect(run).toBeCloseTo(12.77, 2);
	expect(Math.abs(a[2] - b[2])).toBeCloseTo(10, 8);
	expect(Math.hypot(run, b[2] - a[2])).toBeCloseTo(16.22, 2);
});

test('every member of every committed carrier stays within 15 m in space', () => {
	for (const seed of [3, 7, 11, 19]) {
		const world = createWorld(seed);
		const roofs = [...world.state.stacks.keys()];
		let built = 0;
		for (let i = 0; i < roofs.length; i += 5) {
			const from = roofs[i];
			const [x, y] = from.split('/').map(Number);
			for (const [dx, dy] of [
				[0, 0],
				[4, 0],
				[0, -5],
				[-4, 3]
			]) {
				const stroke = paint(world, from, x + dx + '/' + (y + dy));
				if (stroke.failure) {
					expect(stroke.draft).toBe(world);
					continue;
				}
				const rods = installationView(stroke.draft, 'all').filter((p) => p.kind === 'pipe');
				expect(rods.length).toBeGreaterThan(0);
				expect(rods.length).toBe(
					[...stroke.draft.state.parts.values()].filter((p) => p.kind === 'segment').length
				);
				for (const {
					points: [a, b]
				} of rods)
					expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeLessThanOrEqual(15);
				built++;
			}
		}
		expect(built).toBeGreaterThan(0);
	}
});
