// @ts-expect-error Bun supplies the test API.
import { expect, spyOn, test } from 'bun:test';
import * as diagonals from './carrier-diagonals';
import { memberLength } from '../megastructure';
import { buildingPlots } from './building-plots';
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

test('seed 7 repairs the overlong inter-roof diagonal before committing the carrier', () => {
	const world = createWorld(7);
	const survey = spyOn(diagonals, 'probeWallConnections');
	try {
		const stroke = paint(world, '83/47', '87/47');
		expect(stroke.failure).toBeUndefined();
		const proposal: Parameters<typeof diagonals.probeWallConnections> = survey.mock.lastCall!;
		const [grid, parts, cells] = proposal;
		const longitudinal = parts.flatMap((part) => {
			if (part.recipe !== 'brace' || part.anchor.cellId === part.end.cellId) return [];
			const a = position(grid, part.anchor),
				b = position(grid, part.end);
			return [{ a, b, length: memberLength({ p: a }, { p: b }) }];
		});
		const [longest] = longitudinal.sort((a, b) => b.length - a.length);
		expect(longest.length).toBeCloseTo(16.905, 3);
		expect(carrierProbe(grid, parts, cells)).toEqual({
			failure: { reason: 'member-too-long', marks: [[longest.a, longest.b]] }
		});
		const committed = [...stroke.draft.state.parts.values()];
		expect(carrierProbe(buildingPlots(world.grid), committed, cells)).toHaveProperty('parts');
		expect(committed.filter((p) => p.recipe === 'brace')).toHaveLength(
			parts.filter((p) => p.recipe === 'brace').length
		);
	} finally {
		survey.mockRestore();
	}
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
