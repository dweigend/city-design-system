import type { Vec2 } from '../../core/geometry';
import { interpolate, position, triangle } from './catchment-grid';
import type { solveDrainage } from './drainage';

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

export function discharge(area: number, runoff: number) {
	return (0.02 * runoff * area) / 1e6;
}

const widthCoefficient = 31;
const widthExponent = 0.34;

export function channelWidth(flow: number) {
	return widthCoefficient * flow ** widthExponent;
}

// Invert the width law for a caller-supplied reference width at unit runoff.
export function areaForWidth(width: number) {
	return (width / widthCoefficient) ** (1 / widthExponent) / discharge(1e6, 1);
}

function section(xy: Vec2, water: number, area: number, runoff: number): ReachStation {
	const flow = discharge(area, runoff);
	return Object.freeze({
		xy: Object.freeze(xy),
		water,
		width: channelWidth(flow),
		depth: 0.35 * flow ** 0.35,
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
		Math.round(blend(a.water, b.water) * 1000) / 1000,
		(blend(a.discharge, b.discharge) * 1e6) / (0.02 * runoff),
		runoff
	);
}

function roundBend(
	a: ReachStation,
	b: ReachStation,
	c: ReachStation,
	flow: Solution,
	runoff: number
) {
	const start = joinSections(b, a, 0.25, runoff);
	const end = joinSections(b, c, 0.25, runoff);
	const middle = joinSections(
		joinSections(start, b, 0.5, runoff),
		joinSections(b, end, 0.5, runoff),
		0.5,
		runoff
	);
	const terrain = interpolate(flow.bed, triangle(...middle.xy));
	return terrain > middle.water + 1 || terrain < middle.water - 1 ? [b] : [start, middle, end];
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
		return section(xy, flow.level[i] / 1000, area, runoff);
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
