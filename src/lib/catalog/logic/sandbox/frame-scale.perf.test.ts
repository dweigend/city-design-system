// @ts-expect-error Bun supplies the test API at runtime.
import { expect, test } from 'bun:test';
import { warmMedian } from '../../fixtures/performance-sample.fixture.test';
import { createTerrain } from '../terrain';
import { deriveGrid, regrid } from '../terrain-grid';
import { seamIncidence } from './seam-incidence';
import { applyEdit, EMPTY_STATE, frameReport, type World } from './index';

function carrier(seed: number): World {
	const grid = deriveGrid({ ...createTerrain({ seed }), along: 100, across: 100 });
	const stacks = new Map(
		grid.cells
			.filter((c) => c.buildable && (c.column + c.row) % 3 !== 0)
			.map((c) => [c.id, ['living'] as const])
	);
	return { seed, grid, state: { ...EMPTY_STATE, stacks }, lines: [] };
}
const advance = (world: World) => applyEdit(world, { kind: 'advance', years: 1 });

test('100 m contour regrid preserves every incidence address', () => {
	const { grid } = carrier(11),
		first = seamIncidence(grid);
	const next = regrid(grid, {
		...grid.terrain,
		edits: [{ kind: 'basin', center: [0, 0], radius: 9 }]
	});
	expect([...first.values()].map((s) => [s.id, s.sides])).toEqual(
		[...seamIncidence(next).values()].map((s) => [s.id, s.sides])
	);
});

test('stage two tick budget and physical frame census', () => {
	for (const seed of [7, 11, 23]) {
		const start = carrier(seed),
			pending = advance(start);
		const medianMs = warmMedian(
			() => {
				const t = performance.now();
				advance(pending);
				return performance.now() - t;
			},
			3,
			9
		);
		const built = advance(pending),
			report = frameReport(built);
		console.info(
			'TG ' +
				JSON.stringify({
					seed,
					ticks: 2,
					medianMs,
					houses: start.state.stacks.size,
					seams: seamIncidence(start.grid).size,
					installed: [...(built.state.frameInstallations?.values() ?? [])].filter(
						(i) => i.result.status === 'sized'
					).length,
					rejected: [...(built.state.frameInstallations?.values() ?? [])].filter(
						(i) => i.result.status === 'rejected'
					).length,
					longestRun: report.longestRun ?? 'unavailable',
					districtMainShare: Object.fromEntries(report.districtMainShare),
					quiet: report.quiet,
					total: report.total,
					unclassified: report.unclassified,
					gates: report.gateCount
				})
		);
		expect(medianMs).toBeLessThan(100);
	}
}, 60_000);

import { frameIntent } from './frame-intent';
import { runFrameTimeline } from './frame-runner';
test('replanning one painted goal fits the contour tick budget', () => {
	const world = carrier(7),
		house = [...world.state.stacks.keys()][0];
	const painted = frameIntent(world, [house]).draft;
	const sample = () => runFrameTimeline(painted, 1);
	const medianMs = warmMedian(
		() => {
			const t = performance.now();
			sample();
			return performance.now() - t;
		},
		3,
		9
	);
	console.info(
		'PLAN_TICK ' +
			JSON.stringify({ medianMs, warmup: 3, repeats: 9, ...sample().series[0][0].diagnostics })
	);
	expect(medianMs).toBeLessThan(100);
});
