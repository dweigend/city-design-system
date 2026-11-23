import { defaults } from './settings';
import type { Random } from '../../core/random';
import { createCatchment } from './catchment';
import type { RiverCourse } from './course';
import { solveDrainage } from './drainage';
import { position } from './catchment-grid';
import { checkCarvedSills, checkDrainage } from './drainage-check';
import { lakeGeometry } from './lake-geometry';
import { extractReaches, importedCatchmentArea } from './reaches';
import type { ValleyAxis } from './valley-axis';

const { tributaryAreaThresholdM2, lowReliefTributaryAreaIncreaseM2, tributaryAreaReliefExponent } =
	defaults;

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
	const flood = performance.now();
	const inlet = spine[0].index;
	const importedArea = importedCatchmentArea(guide.wetWidth, relief, wetWidth);
	const flow = solveDrainage(grid, inlet, importedArea, spine);
	const floodMs = performance.now() - flood;
	const geometry = performance.now();
	const threshold =
		tributaryAreaThresholdM2 +
		(1 - relief) ** tributaryAreaReliefExponent * lowReliefTributaryAreaIncreaseM2;
	const network = extractReaches(flow, spine, runoff, threshold);
	const lakes = lakeGeometry(flow);
	return {
		check: (height: (x: number, y: number) => number) =>
			Object.freeze({
				...checkDrainage(grid, flow, inlet, importedArea),
				carvedSillFaults: checkCarvedSills(grid, flow, (i) => height(...position(i)))
			}),
		flow,
		field,
		...network,
		lakes,
		timing: { baseMs, floodMs, reachesMs: performance.now() - geometry }
	};
}
