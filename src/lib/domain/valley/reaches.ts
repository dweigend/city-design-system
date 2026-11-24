import { millimetersPerMeter } from './millimeters';
import { defaults } from './settings';
import type { Vec2 } from '../../core/geometry';
import { interpolate, position, triangle } from './catchment-grid';
import type { solveDrainage } from './drainage';

const {
	unitRunoffYieldM3PerSKm2,
	channelWidthCoefficientM,
	channelWidthExponent,
	defaultImportedLowlandAreaKm2,
	importedAreaReferenceWidthM,
	importedAreaReliefDivisor,
	importedAreaReliefExponent,
	channelDepthCoefficientM,
	channelDepthExponent,
	tributaryBendTrimRatio,
	tributaryBendElevationToleranceM
} = defaults;

type Solution = ReturnType<typeof solveDrainage>;
type Trough = readonly { index: number; x: number; y: number; length: number }[];

/** One channel cross section in meters and discharge in cubic meters per second. */
export type ReachStation = Readonly<{
	xy: Vec2;
	water: number;
	width: number;
	depth: number;
	discharge: number;
}>;

/** A downstream channel between sources, junctions, lakes and exits. A lake ID can be downstream. */
export type Reach = Readonly<{
	id: number;
	downstream: number | null;
	trunk: boolean;
	stations: readonly ReachStation[];
}>;

// Exact arithmetic: one square kilometer equals 1,000,000 square meters.
const squareMetersPerSquareKilometer = /* Exact arithmetic: square meters per square kilometer. */ 1e6;

export function discharge(area: number, runoff: number) {
	return (unitRunoffYieldM3PerSKm2 * runoff * area) / squareMetersPerSquareKilometer;
}

export function channelWidth(flow: number) {
	return channelWidthCoefficientM * flow ** channelWidthExponent;
}

// Exact arithmetic: the reference conversion uses a unit multiplier for runoff.
const unitRunoff = /* Exact arithmetic: unit runoff in the width law. */ 1;

// Invert the width law for a caller-supplied reference width at unit runoff.
function areaForWidth(width: number) {
	return (
		(width / channelWidthCoefficientM) ** (1 / channelWidthExponent) /
		discharge(squareMetersPerSquareKilometer, unitRunoff)
	);
}

/** Imported drainage area in square meters. The guide scales the ancestral catchment and
 * a supplied wet width overrides the lowland area through the same channel law. */
export function importedCatchmentArea(guideWetWidth: number, relief: number, wetWidth?: number) {
	const lowlandKm2 =
		wetWidth === undefined
			? defaultImportedLowlandAreaKm2 * (guideWetWidth / importedAreaReferenceWidthM) ** 2
			: areaForWidth(wetWidth);
	return (
		lowlandKm2 *
		(1 / importedAreaReliefDivisor +
			((importedAreaReliefDivisor - 1) / importedAreaReliefDivisor) *
				(1 - relief) ** importedAreaReliefExponent) *
		squareMetersPerSquareKilometer
	);
}

function section(xy: Vec2, water: number, area: number, runoff: number): ReachStation {
	const flow = discharge(area, runoff);
	return Object.freeze({
		xy: Object.freeze(xy),
		water,
		width: channelWidth(flow),
		depth: channelDepthCoefficientM * flow ** channelDepthExponent,
		discharge: flow
	});
}

function importedPath({ receiver, membership, basins }: Solution, inlet: number) {
	const path: number[] = [];
	for (let i = inlet; i >= 0; i = receiver[i]) {
		const basin = basins[membership[i]];
		if (basin && basin.root !== i) i = basin.root;
		path.push(i);
	}
	return path;
}

function courses(flow: Solution, path: ReadonlySet<number>, inlet: number, threshold: number) {
	const { receiver, area, membership } = flow;
	const active = receiver.map((_, i) =>
		Number(membership[i] < 0 && (area[i] >= threshold || path.has(i)))
	);
	for (const { outlet } of flow.basins) {
		for (let i = outlet; i >= 0 && membership[i] < 0 && !active[i]; i = receiver[i]) active[i] = 1;
	}
	const incoming = new Uint8Array(receiver.length);
	for (let i = 0; i < receiver.length; i++) {
		const next = receiver[i];
		if (next >= 0 && active[i]) incoming[next]++;
	}
	for (const { outlet } of flow.basins) {
		if (active[outlet]) incoming[outlet]++;
	}
	const startsAtLake = new Set(flow.basins.map(({ outlet }) => outlet));
	const isStart = (i: number) => incoming[i] !== 1 || startsAtLake.has(i) || i === inlet;
	const starts: number[][] = [];
	for (let i = 0; i < receiver.length; i++) {
		if (!active[i] || receiver[i] < 0 || !isStart(i)) continue;
		const chain = [i];
		let next = receiver[i];
		while (next >= 0) {
			chain.push(next);
			if (!active[next] || isStart(next)) break;
			next = receiver[next];
		}
		starts.push(chain);
	}
	return { starts, incoming };
}

function joinSections(a: ReachStation, b: ReachStation, t: number, runoff: number) {
	const blend = (x: number, y: number) => x + (y - x) * t;
	return section(
		[blend(a.xy[0], b.xy[0]), blend(a.xy[1], b.xy[1])],
		Math.round(blend(a.water, b.water) * millimetersPerMeter) / millimetersPerMeter,
		(blend(a.discharge, b.discharge) * squareMetersPerSquareKilometer) /
			(unitRunoffYieldM3PerSKm2 * runoff),
		runoff
	);
}

// Exact arithmetic: repeated midpoint interpolation constructs the center of the quadratic bend.
const midpointFraction = 1 / 2;

function roundBend(
	a: ReachStation,
	b: ReachStation,
	c: ReachStation,
	flow: Solution,
	runoff: number
) {
	const start = joinSections(b, a, tributaryBendTrimRatio, runoff);
	const end = joinSections(b, c, tributaryBendTrimRatio, runoff);
	const middle = joinSections(
		joinSections(start, b, midpointFraction, runoff),
		joinSections(b, end, midpointFraction, runoff),
		midpointFraction,
		runoff
	);
	const terrain = interpolate(flow.bed, triangle(...middle.xy));
	return terrain > middle.water + tributaryBendElevationToleranceM ||
		terrain < middle.water - tributaryBendElevationToleranceM
		? [b]
		: [start, middle, end];
}

function guideSections(
	flow: Solution,
	chain: readonly number[],
	stations: ReadonlyMap<number, Trough[number]>,
	trunk: boolean,
	runoff: number
) {
	const points = chain.map((i, n) => {
		const guide = stations.get(i);
		const xy: Vec2 = guide ? [guide.x, guide.y] : position(i);
		const previous = chain[Math.max(0, n - 1)];
		const area = !trunk && n === chain.length - 1 ? flow.area[previous] : flow.area[i];
		return section(xy, flow.level[i] / millimetersPerMeter, area, runoff);
	});
	if (trunk) return points;
	return points.flatMap((point, i) =>
		i === 0 || i + 1 === points.length || stations.has(chain[i])
			? [point]
			: roundBend(points[i - 1], point, points[i + 1], flow, runoff)
	);
}

export function extractReaches(flow: Solution, spine: Trough, runoff: number, threshold: number) {
	const path = importedPath(flow, spine[0].index);
	const trunk = new Set(path);
	const guide = new Map(spine.map((point) => [point.index, point]));
	const { starts, incoming } = courses(flow, trunk, spine[0].index, threshold);
	const byVertex = new Map(starts.map(([i]) => [i, i]));
	const reaches = starts.map((chain): Reach => {
		const id = chain[0];
		const last = chain[chain.length - 1];
		const basin = flow.membership[last];
		return Object.freeze({
			id,
			downstream: basin < 0 ? (byVertex.get(last) ?? null) : -1 - basin,
			trunk: trunk.has(id),
			stations: Object.freeze(guideSections(flow, chain, guide, trunk.has(id), runoff))
		});
	});
	return { reaches: Object.freeze(reaches), path, guide, junctions: incoming };
}
