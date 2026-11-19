// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { expect, test } from 'bun:test';
import { createTerrain, valleyPoint } from '../terrain';
import { deriveGrid, MODULE, regrid } from './index';

const SEED = 7;
const BASIN_RADIUS_METERS = 9;
const WARMUP_RUNS = 2;
const MEASURED_RUNS = 5;
const REGRID_BUDGET_MS = 40;
const TEST_TIMEOUT_MS = 15_000;
const sites = [
	[48, 26],
	[60, 42],
	[70, 40],
	[58, 60],
	[86, 80],
	[12, 56],
	[95, 67],
	[120, 78]
];

function median(times: number[]) {
	times.sort((a, b) => a - b);
	const middle = Math.floor(times.length / 2);
	return times.length % 2 === 0 ? (times[middle - 1] + times[middle]) / 2 : times[middle];
}

test(
	'performance: warm basin regrid stays within a 40 ms median across eight sites',
	() => {
		const terrain = createTerrain({ seed: SEED });
		const grid = deriveGrid(terrain);
		const basins = sites.map(([column, row]) => {
			const center = valleyPoint(terrain, column * MODULE, row * MODULE);
			return createTerrain({
				seed: SEED,
				edits: [{ kind: 'basin', radius: BASIN_RADIUS_METERS, center }]
			});
		});
		const measureRun = () =>
			median(
				basins.map((dug) => {
					const start = performance.now();
					regrid(grid, dug);
					return performance.now() - start;
				})
			);
		for (let run = 0; run < WARMUP_RUNS; run++) measureRun();
		const medianMs = median(Array.from({ length: MEASURED_RUNS }, measureRun));
		console.info('Warm basin regrid median:', medianMs.toFixed(2), 'ms');
		expect(medianMs).toBeLessThanOrEqual(REGRID_BUDGET_MS);
	},
	TEST_TIMEOUT_MS
);
