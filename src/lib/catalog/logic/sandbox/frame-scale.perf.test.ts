import { expect, test } from 'bun:test';
import { resourceUsage } from 'node:process';
import { warmMedian } from '../../fixtures/performance-sample.fixture.test';
import { regrid } from '../terrain-grid';
import { seamIncidence } from './seam-incidence';
import { applyEdit, frameReport, type World } from './index';

import { frameCarrier as carrier } from './fixtures/frame-carrier.fixture.test';
const advance = (world: World) => applyEdit(world, { kind: 'advance', years: 1 });

test('100 m contour regrid preserves every incidence address', () => {
	const { grid } = carrier(11),
		first = seamIncidence(grid);
	const near = grid.cellsById.get('4/4');
	if (!near) throw new Error('Missing basin parcel');
	const next = regrid(grid, {
		...grid.terrain,
		edits: [{ kind: 'basin', center: [near.center[0], near.center[1]], radius: 9 }]
	});
	expect(next.cellsById.get(near.id)?.corners).not.toEqual(near.corners);
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
			JSON.stringify({
				medianMs,
				processPeakRssKiB: resourceUsage().maxRSS,
				warmup: 3,
				repeats: 9,
				...sample().series[0][0].diagnostics
			})
	);
	expect(medianMs).toBeLessThan(100);
});

import { prepareAdvance } from './world';
import { sizeFrameSites } from './frame-sizing';

test('snapshot sizing and foreground advance with several independent painted goals', () => {
	for (const count of [4, 8]) {
		let world = carrier(7);
		const parcels = [...world.state.stacks.keys()];
		for (let i = 0; i < count; i++)
			world = frameIntent(world, [parcels[Math.floor((i * parcels.length) / count)]]).draft;
		const samples: number[][] = [[], [], []];
		for (let i = 0; i < 12; i++) {
			const start = performance.now();
			const work = prepareAdvance(world);
			expect(work.preview().state.parts).toBe(world.state.parts);
			const preview = performance.now();
			const proofs = sizeFrameSites(work.sites);
			const sized = performance.now();
			const built = work.finish(proofs);
			const end = performance.now();
			expect(built.state.frameTimeline?.results).toHaveLength(count);
			if (i >= 3)
				[preview - start, sized - preview, end - sized].forEach((ms, j) => samples[j].push(ms));
		}
		const [previewMs, sizingMs, commitMs] = samples.map((xs) => xs.sort((a, b) => a - b)[4]);
		console.info(
			'PLAN_BATCH ' +
				JSON.stringify({
					seed: 7,
					count,
					warmup: 3,
					repeats: 9,
					previewMs,
					sizingMs,
					commitMs,
					processPeakRssKiB: resourceUsage().maxRSS
				})
		);
	}
}, 60000);
