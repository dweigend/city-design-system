import type { Reach } from './reaches';
import type { terrainSampler } from './terrain-sample';

type Sample = ReturnType<typeof terrainSampler>;

/** Square survey window centered on the origin, in meters. */
export type SurveyWindow = Readonly<{ sideM: number; spacingM: number; buildableSlope: number }>;

/** Default survey: the 4 km square around the valley center at 20 m, buildable below 20 %. */
export const surveyDefaults: SurveyWindow = Object.freeze({
	sideM: 4000,
	spacingM: 20,
	buildableSlope: 0.2
});

/** Dry ground at a sampled shoreline may be at most 1 cm below its local water surface. */
const waterToleranceM = 0.01;

/** Hydrology faults: downstream course steps whose water rises, the spread of the lake surface
 * in meters, and sampled shore crossings with dry ground below the local water surface. */
export type HydrologyFaults = Readonly<{
	uphillSteps: number;
	lakeTiltM: number;
	shoreBelowWater: number;
}>;

/** Measured ground in a survey window. Heights in meters, slopes rise/run, shares of all nodes,
 * areas in square meters. */
export type GroundSurvey = Readonly<{
	lowestM: number;
	highestM: number;
	reliefM: number;
	maxSlope: number;
	maxWetSlope: number;
	drySlope: Readonly<{ p50: number; p95: number; max: number }>;
	waterShare: number;
	lakeArea: number;
	buildableShare: number;
	faults: HydrologyFaults;
}>;

type Nodes = Readonly<{
	side: number;
	spacing: number;
	half: number;
	heights: Float64Array;
	water: Float64Array;
	wet: Uint8Array;
	lake: Int32Array;
}>;

function sampleNodes(sample: Sample, { sideM, spacingM }: SurveyWindow): Nodes {
	const subdivisions = Math.ceil(sideM / spacingM);
	const side = subdivisions + 1;
	const spacing = sideM / subdivisions;
	const nodes = {
		side,
		spacing,
		half: sideM / 2,
		heights: new Float64Array(side * side),
		water: new Float64Array(side * side),
		wet: new Uint8Array(side * side),
		lake: new Int32Array(side * side)
	};
	for (let row = 0; row < side; row++) {
		for (let column = 0; column < side; column++) {
			const x = -sideM / 2 + column * spacing;
			const y = sideM / 2 - row * spacing;
			const { height, water, waterKind, lakeId } = sample(x, y);
			const index = row * side + column;
			nodes.heights[index] = height;
			nodes.water[index] = water;
			nodes.wet[index] = waterKind === null ? 0 : 1;
			nodes.lake[index] = lakeId ?? 0;
		}
	}
	return nodes;
}

function nodeSlope({ heights, side, spacing }: Nodes, row: number, column: number) {
	const at = (r: number, c: number) =>
		heights[Math.min(side - 1, Math.max(0, r)) * side + Math.min(side - 1, Math.max(0, c))];
	const dx = (at(row, column + 1) - at(row, column - 1)) / (2 * spacing);
	const dy = (at(row - 1, column) - at(row + 1, column)) / (2 * spacing);
	return Math.hypot(dx, dy);
}

function shoreFaults(
	sample: Sample,
	{ wet, side, spacing, half }: Nodes,
	row: number,
	column: number
) {
	if (wet[row * side + column]) return 0;
	const x = -half + column * spacing;
	const y = half - row * spacing;
	let faults = 0;
	for (const [dr, dc] of [
		[-1, 0],
		[1, 0],
		[0, -1],
		[0, 1]
	]) {
		const r = row + dr;
		const c = column + dc;
		if (r < 0 || c < 0 || r >= side || c >= side || !wet[r * side + c]) continue;
		let dry = 0;
		let water = spacing;
		while (water - dry > 0.001) {
			const mid = (water + dry) / 2;
			if (sample(x + dc * mid, y - dr * mid).waterKind === null) dry = mid;
			else water = mid;
		}
		const land = sample(x + dc * dry, y - dr * dry).height;
		const surface = sample(x + dc * water, y - dr * water).water;
		if (land < surface - waterToleranceM) faults++;
	}
	return faults;
}

function uphillSteps(reaches: readonly Reach[], halfM: number) {
	let steps = 0;
	for (const { stations } of reaches) {
		for (let i = 1; i < stations.length; i++) {
			const {
				xy: [x, y],
				water
			} = stations[i];
			if (Math.max(Math.abs(x), Math.abs(y)) <= halfM && water > stations[i - 1].water) steps++;
		}
	}
	return steps;
}

/** Samples every node of the window once and measures relief, slope, water and buildable land,
 * and bisects wet–dry grid edges to 1 mm to check land against water at the same shore. */
export function surveyGround(
	sample: Sample,
	reaches: readonly Reach[],
	window: SurveyWindow
): GroundSurvey {
	if (
		![window.sideM, window.spacingM, window.buildableSlope].every(Number.isFinite) ||
		!(window.spacingM > 0 && window.sideM > 2 * window.spacingM && window.buildableSlope > 0)
	)
		throw new RangeError('invalid-survey');
	const nodes = sampleNodes(sample, window);
	const { side, heights, wet } = nodes;
	const tally = {
		maxSlope: 0,
		maxWetSlope: 0,
		water: 0,
		buildable: 0,
		lake: 0,
		shoreBelow: 0
	};
	let [lowest, highest] = [Infinity, -Infinity];
	const levels = new Map<number, { low: number; high: number }>();
	const drySlopes: number[] = [];
	for (let row = 0; row < side; row++) {
		for (let column = 0; column < side; column++) {
			const index = row * side + column;
			const slope = nodeSlope(nodes, row, column);
			[lowest, highest] = [Math.min(lowest, heights[index]), Math.max(highest, heights[index])];
			tally.maxSlope = Math.max(tally.maxSlope, slope);
			if (wet[index]) {
				tally.water++;
				tally.maxWetSlope = Math.max(tally.maxWetSlope, slope);
			} else {
				drySlopes.push(slope);
				if (slope < window.buildableSlope) tally.buildable++;
			}
			tally.shoreBelow += shoreFaults(sample, nodes, row, column);
			if (!nodes.lake[index]) continue;
			tally.lake++;
			const water = nodes.water[index];
			const level = levels.get(nodes.lake[index]);
			if (level) {
				level.low = Math.min(level.low, water);
				level.high = Math.max(level.high, water);
			} else levels.set(nodes.lake[index], { low: water, high: water });
		}
	}
	const count = side * side;
	drySlopes.sort((a, b) => a - b);
	const drySlope = (q: number) => drySlopes[Math.round(q * (drySlopes.length - 1))] ?? 0;
	return Object.freeze({
		lowestM: lowest,
		highestM: highest,
		reliefM: highest - lowest,
		maxSlope: tally.maxSlope,
		maxWetSlope: tally.maxWetSlope,
		drySlope: Object.freeze({ p50: drySlope(0.5), p95: drySlope(0.95), max: drySlope(1) }),
		waterShare: tally.water / count,
		lakeArea: tally.lake * nodes.spacing ** 2,
		buildableShare: tally.buildable / count,
		faults: Object.freeze({
			uphillSteps: uphillSteps(reaches, window.sideM / 2),
			lakeTiltM: Math.max(0, ...Array.from(levels.values(), ({ low, high }) => high - low)),
			shoreBelowWater: tally.shoreBelow
		})
	});
}
