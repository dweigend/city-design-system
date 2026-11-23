import { lakeDistance, type Lake } from './lake';

type Sample = (x: number, y: number) => Readonly<{ height: number; water: number; bank: number }>;

/** Square survey window centered on the origin, in meters. */
export type SurveyWindow = Readonly<{ sideM: number; spacingM: number; buildableSlope: number }>;

/** Default survey: the 4 km square around the valley center at 20 m, buildable below 20 %. */
export const surveyDefaults: SurveyWindow = Object.freeze({
	sideM: 4000,
	spacingM: 20,
	buildableSlope: 0.2
});

/** Water may fall by this much between neighbouring nodes without counting as a fault. */
const waterToleranceM = 0.01;

/** Hydrology faults: downstream course steps whose water rises, the spread of the lake surface
 * in meters, and dry nodes lower than the water of a wet four-neighbour. All zero when sound. */
export type HydrologyFaults = Readonly<{
	uphillSteps: number;
	lakeTiltM: number;
	dryBelowWater: number;
}>;

/** Measured ground in a survey window. Heights in meters, slopes rise/run, shares of all nodes,
 * areas in square meters. */
export type GroundSurvey = Readonly<{
	lowestM: number;
	highestM: number;
	reliefM: number;
	maxSlope: number;
	waterShare: number;
	lakeArea: number;
	buildableShare: number;
	faults: HydrologyFaults;
}>;

type Nodes = Readonly<{
	side: number;
	spacing: number;
	heights: Float64Array;
	water: Float64Array;
	wet: Uint8Array;
	lake: Uint8Array;
}>;

function sampleNodes(sample: Sample, lake: Lake | null, { sideM, spacingM }: SurveyWindow): Nodes {
	const side = Math.round(sideM / spacingM) + 1;
	const nodes = {
		side,
		spacing: spacingM,
		heights: new Float64Array(side * side),
		water: new Float64Array(side * side),
		wet: new Uint8Array(side * side),
		lake: new Uint8Array(side * side)
	};
	for (let row = 0; row < side; row++) {
		for (let column = 0; column < side; column++) {
			const x = -sideM / 2 + column * spacingM;
			const y = sideM / 2 - row * spacingM;
			const { height, water, bank } = sample(x, y);
			const index = row * side + column;
			nodes.heights[index] = height;
			nodes.water[index] = water;
			nodes.wet[index] = bank > 0 ? 0 : 1;
			nodes.lake[index] = nodes.wet[index] && lake && lakeDistance(lake, x, y) < 0 ? 1 : 0;
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

function dryBelowWater({ heights, water, wet, side }: Nodes, row: number, column: number) {
	const index = row * side + column;
	if (wet[index]) return false;
	for (const [r, c] of [
		[row - 1, column],
		[row + 1, column],
		[row, column - 1],
		[row, column + 1]
	]) {
		if (r < 0 || c < 0 || r >= side || c >= side) continue;
		const other = r * side + c;
		if (wet[other] && heights[index] < water[other] - waterToleranceM) return true;
	}
	return false;
}

function uphillSteps(sample: Sample, course: readonly number[], halfM: number): number {
	let previous = Infinity;
	let steps = 0;
	for (let i = 0; i < course.length; i += 2) {
		if (Math.max(Math.abs(course[i]), Math.abs(course[i + 1])) > halfM) continue;
		const { water } = sample(course[i], course[i + 1]);
		if (water > previous) steps++;
		previous = water;
	}
	return steps;
}

/** Samples every node of the window once and measures relief, slope, water and buildable land,
 * and checks the hydrology along the course inside the window. */
export function surveyGround(
	sample: Sample,
	lake: Lake | null,
	course: readonly number[],
	window: SurveyWindow
): GroundSurvey {
	if (!(window.sideM > 2 * window.spacingM) || !(window.buildableSlope > 0))
		throw new RangeError('invalid-survey');
	const nodes = sampleNodes(sample, lake, window);
	const { side, heights, wet } = nodes;
	const tally = { maxSlope: 0, water: 0, buildable: 0, lake: 0, below: 0 };
	let [lowest, highest, lakeLow, lakeHigh] = [Infinity, -Infinity, Infinity, -Infinity];
	for (let row = 0; row < side; row++) {
		for (let column = 0; column < side; column++) {
			const index = row * side + column;
			const slope = nodeSlope(nodes, row, column);
			[lowest, highest] = [Math.min(lowest, heights[index]), Math.max(highest, heights[index])];
			tally.maxSlope = Math.max(tally.maxSlope, slope);
			if (wet[index]) tally.water++;
			else if (slope < window.buildableSlope) tally.buildable++;
			if (dryBelowWater(nodes, row, column)) tally.below++;
			if (!nodes.lake[index]) continue;
			tally.lake++;
			[lakeLow, lakeHigh] = [
				Math.min(lakeLow, nodes.water[index]),
				Math.max(lakeHigh, nodes.water[index])
			];
		}
	}
	const count = side * side;
	return Object.freeze({
		lowestM: lowest,
		highestM: highest,
		reliefM: highest - lowest,
		maxSlope: tally.maxSlope,
		waterShare: tally.water / count,
		lakeArea: tally.lake * window.spacingM ** 2,
		buildableShare: tally.buildable / count,
		faults: Object.freeze({
			uphillSteps: uphillSteps(sample, course, window.sideM / 2),
			lakeTiltM: tally.lake ? lakeHigh - lakeLow : 0,
			dryBelowWater: tally.below
		})
	});
}
