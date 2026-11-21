import { distance, pointAt, type Point } from '../../core/polyline';

type Sampler = (x: number, y: number) => number;
type ProfilePoint = Readonly<{ offset: number; signed: number; height: number; terrace: number }>;
type Station = (offset: number) => Point;

function chainage(xy: ArrayLike<number>): Float64Array {
	const chain = new Float64Array(xy.length / 2);
	for (let i = 1; i < chain.length; i++) {
		chain[i] = chain[i - 1] + distance(pointAt(xy, (i - 1) * 2), pointAt(xy, i * 2));
	}
	return chain;
}

function courseAt(xy: ArrayLike<number>, chain: Float64Array, target: number): Point {
	let lo = 0;
	let hi = chain.length - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >>> 1;
		if (chain[mid] > target) hi = mid;
		else lo = mid;
	}
	const a = pointAt(xy, lo * 2);
	const b = pointAt(xy, hi * 2);
	const t = (target - chain[lo]) / (chain[hi] - chain[lo]);
	return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

/** Places normal profiles at fixed offsets along the clipped course. */
export function crossSections(
	xy: ArrayLike<number>,
	first: number,
	spacing: number,
	tangentHalfLength: number
): Station[] {
	const chain = chainage(xy);
	const stations: Station[] = [];
	const end = chain[chain.length - 1];
	for (let along = first; along < end; along += spacing) {
		const center = courseAt(xy, chain, along);
		const a = courseAt(xy, chain, Math.max(0, along - tangentHalfLength));
		const b = courseAt(xy, chain, Math.min(end, along + tangentHalfLength));
		const length = distance(a, b);
		if (length === 0) continue;
		const nx = (a.y - b.y) / length;
		const ny = (b.x - a.x) / length;
		stations.push((offset) => ({ x: center.x + nx * offset, y: center.y + ny * offset }));
	}
	return stations;
}

/** Samples signed bed and smoothed filled height on a normal, stopping at the square border. */
export function profileAt(
	station: Station,
	halfLength: number,
	spacing: number,
	windowM: number,
	signed: Sampler,
	height: Sampler,
	terrace?: Sampler
): ProfilePoint[] {
	const points: ProfilePoint[] = [];
	for (let offset = -halfLength; offset <= halfLength; offset += spacing) {
		const { x, y } = station(offset);
		if (Math.max(Math.abs(x), Math.abs(y)) > windowM / 2) continue;
		points.push({
			offset,
			signed: signed(x, y),
			height: height(x, y),
			terrace: terrace?.(x, y) ?? 0
		});
	}
	return points;
}

function shore({ offset, signed }: ProfilePoint, dry: ProfilePoint): number {
	return offset + ((dry.offset - offset) * -signed) / (dry.signed - signed);
}

/** Finds the banks of the connected wet interval, or null if either is censored. */
export function wetBanks(profile: readonly ProfilePoint[]) {
	const center = profile.findIndex(({ offset }) => offset === 0);
	if (center < 0 || profile[center].signed >= 0) return null;
	let left = center;
	let right = center;
	while (left > 0 && profile[left - 1].signed < 0) left--;
	while (right + 1 < profile.length && profile[right + 1].signed < 0) right++;
	if (left === 0 || right + 1 === profile.length) return null;
	return {
		left: shore(profile[left], profile[left - 1]),
		right: shore(profile[right], profile[right + 1]),
		leftDry: left - 1,
		rightDry: right + 1
	};
}

function terraceEdge(profile: readonly ProfilePoint[], start: number, direction: -1 | 1) {
	for (let i = start; i >= 0 && i < profile.length; i += direction) {
		const point = profile[i];
		if (point.terrace < 0.5) continue;
		const prior = profile[i - direction];
		return (
			prior.offset +
			((point.offset - prior.offset) * (0.5 - prior.terrace)) / (point.terrace - prior.terrace)
		);
	}
	return null;
}

/** Measures the dry distance from each bank to its first mapped terrace. */
export function floodplainWidths(
	profile: readonly ProfilePoint[],
	banks: NonNullable<ReturnType<typeof wetBanks>>
): readonly [leftM: number, rightM: number] | null {
	const left = terraceEdge(profile, banks.leftDry, -1);
	const right = terraceEdge(profile, banks.rightDry, 1);
	if (left === null || right === null) return null;
	return [Math.max(0, banks.left - left), Math.max(0, right - banks.right)];
}

function grade(profile: readonly ProfilePoint[], index: number): number {
	const low = profile[Math.max(0, index - 1)];
	const high = profile[Math.min(profile.length - 1, index + 1)];
	return (high.height - low.height) / (high.offset - low.offset);
}

/** Collects gains of contiguous, same-sign steep runs outside water on one profile. */
export function stepCandidates(
	profile: readonly ProfilePoint[],
	minimumSlope: number,
	minimumGainM: number
): number[] {
	const heights: number[] = [];
	for (const sign of [-1, 1]) {
		let start = -1;
		for (let i = 0; i < profile.length; i++) {
			if (profile[i].signed >= 0 && grade(profile, i) * sign > minimumSlope) {
				if (start === -1) start = i;
				continue;
			}
			if (start === -1) continue;
			const stop = profile[i].signed < 0 ? i - 1 : i;
			const rise = sign * (profile[stop].height - profile[start].height);
			if (rise >= minimumGainM) heights.push(rise);
			start = -1;
		}
		// An unfinished run is censored at the field border.
	}
	return heights;
}
