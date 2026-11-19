import { expect, test } from 'bun:test';
import { deriveGrid } from '../terrain-grid';
import { createTerrain } from '../terrain';
import { applyEdit, EMPTY_STATE, frameReport, frameSurvey, type World } from './index';

test('the game advances the same seed-7 frame without changing the stock houses', () => {
	const terrain = { ...createTerrain({ seed: 7 }), along: 100, across: 100 };
	const grid = deriveGrid(terrain);
	const stacks = new Map(
		grid.cells
			.filter((c) => c.column === 4 && c.row >= 2 && c.row <= 6 && c.zone !== 'water')
			.map((c) => [c.id, ['living'] as const])
	);
	const world: World = { grid, seed: 7, lines: [], state: { ...EMPTY_STATE, stacks } };
	const first = applyEdit(world, { kind: 'advance', years: 1 });
	const second = applyEdit(first, { kind: 'advance', years: 1 });
	expect(second.state.stacks).toBe(stacks);
	expect(first.state.stacks).toBe(world.state.stacks);
	const survey = frameSurvey(world);
	expect(survey.seams.size).toBeGreaterThan(0);
	const report = frameReport(second);
	for (const id of survey.seams.keys()) {
		const trace = report.explain(id);
		expect(trace.diagnostics).toHaveLength(12);
		expect(trace.diagnostics.find((d) => d.measure === 'water-crossing')?.value).toBe(0);
	}
});

import { runFrameTimeline } from './index';
import { frameIntent } from './frame-intent';

test('a painted goal survives forecast error, fork and replay on the actual contour world', () => {
	const seed = 7,
		grid = deriveGrid({ ...createTerrain({ seed }), along: 100, across: 100 });
	const stacks = new Map(
		grid.cells
			.filter((c) => c.buildable && (c.column + c.row) % 3 !== 0)
			.map((c) => [c.id, ['living'] as const])
	);
	const world: World = { grid, seed, state: { ...EMPTY_STATE, stacks }, lines: [] };
	const { id, house } = builtFrontage(world);
	const painted = frameIntent(world, [house]).draft;
	const baseline = runFrameTimeline(painted, 3);
	const replay = runFrameTimeline(painted, 3);
	expect(JSON.stringify(replay.series)).toBe(JSON.stringify(baseline.series));
	const checkpoint = baseline.checkpoints[1],
		plan = baseline.series[0][0],
		goal = painted.state.frameTimeline?.goals[0];
	expect(goal?.id).toBe(plan.goal);
	const seam = plan.phases.find((p) => p.seam)?.seam ?? id;
	const fork = runFrameTimeline(checkpoint, 2, () => ({
		observations: [{ seam, from: 2, reason: 'court-access' }]
	}));
	expect(fork.series[0][0].goal).toBe(plan.goal);
	expect(fork.series[0][0].phases[0].seam).not.toBe(seam);
	expect(fork.checkpoints[2].state.stacks).toBe(stacks);
	for (const [key, bay] of checkpoint.state.frameBays ?? [])
		if (bay.built) expect(fork.checkpoints[2].state.frameBays?.get(key)?.built).toBeDefined();
	expect(frameReport(fork.checkpoints[1]).explain(plan.literal).planning?.[0]).toEqual(
		fork.series[0][0]
	);
});

import { advanceFrames } from './frame-construction';
test('64 seeded integrated planning ticks agree on regional stock, pending durations and installed sections', () => {
	for (let seed = 0; seed < 64; seed++) {
		const grid = deriveGrid({ ...createTerrain({ seed }), along: 100, across: 100 });
		const row = grid.cells.filter((c) => c.buildable).slice(0, 10);
		const stacks = new Map(row.map((c) => [c.id, ['living'] as const]));
		let world = frameIntent({ seed, grid, state: { ...EMPTY_STATE, stacks }, lines: [] }, [
			row[0].id,
			row[1].id
		]).draft;
		const replay = runFrameTimeline(world, 3, undefined, 1);
		for (let t = 1; t <= 3; t++) {
			const survey = frameSurvey(world);
			const region = [...survey.seams.keys()].filter((_, i) => i % 3 === seed % 3);
			const full = advanceFrames(world, 2026 + t),
				local = advanceFrames(world, 2026 + t, region);
			for (const id of region) {
				expect(local.frameBays.get(id)).toEqual(full.frameBays.get(id));
				expect(local.frameInstallations.get(id)).toEqual(full.frameInstallations.get(id));
			}
			world = applyEdit(world, { kind: 'advance', years: 1 });
			expect(world.state.frameTimeline).toEqual(replay.checkpoints[t].state.frameTimeline);
			expect(world.state.frameBays).toEqual(replay.checkpoints[t].state.frameBays);
			expect(world.state.parts).toEqual(replay.checkpoints[t].state.parts);
			expect(world.state.stacks).toBe(stacks);
		}
	}
}, 60_000);

function builtFrontage(world: World) {
	const stable = applyEdit(applyEdit(world, { kind: 'advance', years: 1 }), {
		kind: 'advance',
		years: 1
	});
	const id = [...(stable.state.frameBays ?? [])].find(([, s]) => s.built === 'main')?.[0];
	if (!id) throw new Error('Missing surveyed main run');
	const house = frameSurvey(world).seams.get(id)?.houses[0];
	if (!house) throw new Error('Missing supporting roof');
	return { id, house };
}
