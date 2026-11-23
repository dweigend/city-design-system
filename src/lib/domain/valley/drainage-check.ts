import type { solveDrainage } from './drainage';
import { vertexArea, type DrainageGrid } from './drainage-grid';
import { floodTerrain } from './flood';

/** Catchment conservation residuals in square meters and counts of invalid receiver steps. */
export type DrainageCheck = Readonly<{
	areaResidualM2: number;
	nodeBalanceFaults: number;
	uphillReceivers: number;
	maxDryTriangleSlope: number;
	carvedSillFaults: number;
}>;

function dryTriangleSlope(
	{ side, spacing }: DrainageGrid,
	{ bed, membership }: ReturnType<typeof solveDrainage>
) {
	let maximum = 0;
	const measure = (a: number, middle: number, c: number) => {
		if (membership[a] >= 0 || membership[middle] >= 0 || membership[c] >= 0) return;
		maximum = Math.max(maximum, Math.hypot(bed[a] - bed[middle], bed[c] - bed[middle]));
	};
	for (let row = 0; row < side - 1; row++) {
		for (let a = row * side; a < row * side + side - 1; a++) {
			const c = a + side + 1;
			measure(a, a + 1, c);
			measure(a, a + side, c);
		}
	}
	return maximum / (1000 * spacing);
}

export function checkDrainage(
	grid: DrainageGrid,
	flow: ReturnType<typeof solveDrainage>,
	inlet: number,
	importedArea: number
): Omit<DrainageCheck, 'carvedSillFaults'> {
	const { area, receiver, level, order } = flow;
	const rank = new Int32Array(order.length);
	for (let i = 0; i < order.length; i++) rank[order[i]] = i;
	const collected = new Float64Array(area.length);
	let outflow = 0;
	let uphillReceivers = 0;
	for (let i = 0; i < area.length; i++) {
		collected[i] += vertexArea(grid.side, grid.spacing, i);
		const next = receiver[i];
		if (next < 0) outflow += area[i];
		else {
			collected[next] += area[i];
			if (level[next] > level[i] || (level[next] === level[i] && rank[next] >= rank[i]))
				uphillReceivers++;
		}
	}
	collected[inlet] += importedArea;
	let nodeBalanceFaults = 0;
	for (let i = 0; i < area.length; i++) {
		if (Math.abs(area[i] - collected[i]) > 1e-9 * Math.max(1, area[i])) nodeBalanceFaults++;
	}
	const expected = importedArea + (grid.spacing * (grid.side - 1)) ** 2;
	return Object.freeze({
		areaResidualM2: Math.abs(outflow - expected),
		nodeBalanceFaults,
		uphillReceivers,
		maxDryTriangleSlope: dryTriangleSlope(grid, flow)
	});
}

/** Re-flood the triangulation after the final ground sampler has cut the channels. */
export function checkCarvedSills(
	grid: DrainageGrid,
	flow: ReturnType<typeof solveDrainage>,
	sampleHeight: (index: number) => number
) {
	if (!flow.basins.length) return 0;
	const bed = Int32Array.from(flow.bed, (_, i) => Math.round(sampleHeight(i) * 1000));
	const { level } = floodTerrain({ ...grid, bed });
	let faults = 0;
	for (const basin of flow.basins) {
		if (level[basin.root] !== basin.level || bed[basin.outlet] !== basin.level) faults++;
	}
	return faults;
}
