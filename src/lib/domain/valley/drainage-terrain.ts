import type { Random } from '../../core/random';
import { createCatchment } from './catchment';
import type { RiverCourse } from './course';
import { solveDrainage } from './drainage';
import { lakeGeometry } from './lake-geometry';
import { extractReaches } from './reaches';
import type { ValleyAxis } from './valley-axis';

export function drainageTerrain(
	guide: RiverCourse,
	axis: ValleyAxis,
	root: Random,
	relief: number,
	runoff: number,
	wetWidth?: number
) {
	const start = performance.now();
	const { grid, spine, field } = createCatchment(guide, axis, root, relief);
	const baseMs = performance.now() - start;
	const calibration = 48 * Math.sqrt(60);
	const upstreamKm2 =
		(20 + 2980 * (1 - relief) ** 2) * ((wetWidth ?? guide.wetWidth) / calibration) ** 2;
	const flood = performance.now();
	const flow = solveDrainage(grid, spine[0].index, upstreamKm2 * 1e6, spine);
	const floodMs = performance.now() - flood;
	const geometry = performance.now();
	const threshold = 500_000 + (1 - relief) ** 4 * 7_500_000;
	const network = extractReaches(flow, spine, runoff, threshold);
	const lakes = lakeGeometry(flow, threshold);
	return {
		flow,
		field,
		...network,
		lakes,
		timing: { baseMs, floodMs, reachesMs: performance.now() - geometry }
	};
}
