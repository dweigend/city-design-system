import type { Vec2 } from '../../core/geometry';
import { position } from './catchment-grid';
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

export function channelWidth(flow: number) {
	return 48 * Math.sqrt(flow);
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

function guideSections(
	flow: Solution,
	chain: readonly number[],
	stations: ReadonlyMap<number, Trough[number]>,
	runoff: number
) {
	const points: ReachStation[] = [];
	const at = (i: number): Vec2 => {
		const guide = stations.get(i);
		return guide ? [guide.x, guide.y] : position(i);
	};
	for (let n = 0; n < chain.length; n++) {
		const i = chain[n];
		points.push(section(at(i), flow.level[i] / 1000, flow.area[i], runoff));
	}
	return points;
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
			stations: Object.freeze(guideSections(flow, chain, guide, runoff))
		});
	});
	return { reaches: Object.freeze(reaches), path, guide, junctions: incoming };
}
