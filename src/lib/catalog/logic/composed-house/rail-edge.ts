import type { Vec3 } from '../parametrik/types';
import type { Station } from './stair-track';

export type RailLeg = { flight: number; a: Station; b: Station; high: number; low: number };
export type RailReason = 'wall' | 'clearance' | 'parcel' | 'volume';
export type RailEdgeReport = {
	flight: number;
	side: 'inner' | 'outer';
	length: number;
	covered: number;
	omitted: Record<RailReason, number>;
};

export function railDistance(a: Vec3, b: Vec3) {
	return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Samples a stair turn on its concentric arc and straight runs on the tread edge. */
function stations({ a, b, high, low }: RailLeg, offset: number) {
	const [x, y] = a.normal,
		[u, v] = b.normal;
	const turn = Math.atan2(x * v - y * u, x * u + y * v);
	const divisions = Math.abs(turn) > 1e-8 ? 4 : 1;
	const radius =
		divisions === 1
			? 0
			: Math.hypot(b.xy[0] - a.xy[0], b.xy[1] - a.xy[1]) / Math.hypot(x - u, y - v);
	return Array.from({ length: divisions }, (_, i): Vec3 => {
		const t = i / divisions,
			z = high + (low - high) * t;
		return [
			a.xy[0] - radius * x + (radius + offset) * (x * Math.cos(turn * t) - y * Math.sin(turn * t)),
			a.xy[1] - radius * y + (radius + offset) * (x * Math.sin(turn * t) + y * Math.cos(turn * t)),
			z
		];
	});
}

function survey(legs: RailLeg[], offset: number) {
	const last = legs[legs.length - 1];
	const points = legs.flatMap((l) => stations(l, offset));
	points.push([
		last.b.xy[0] + offset * last.b.normal[0],
		last.b.xy[1] + offset * last.b.normal[1],
		last.low
	]);
	points.reverse();
	const distances = [0];
	for (let i = 1; i < points.length; i++)
		distances.push(distances[i - 1] + railDistance(points[i - 1], points[i]));

	function at(d: number): Vec3 {
		let i = 1,
			high = points.length - 1;
		while (i < high) {
			const mid = (i + high) >>> 1;
			if (distances[mid] < d) i = mid + 1;
			else high = mid;
		}
		const t = (d - distances[i - 1]) / (distances[i] - distances[i - 1]);
		return points[i - 1].map((value, k) => value + (points[i][k] - value) * t) as Vec3;
	}
	return { total: distances[distances.length - 1], at };
}

/** Divides one flight edge from its bottom landing up; any stock-length remainder is measured. */
export function edgeBays(legs: RailLeg[], offset: number, span: number) {
	const { total, at } = survey(legs, offset);
	const unit = span / 4;
	const count = Math.max(1, Math.floor(total / (unit * 1.025)));
	const pitch = total / count;
	function bay(i: number, n: number) {
		const start = i * pitch,
			end = (i + n) * pitch,
			a = at(start),
			b = at(end);
		const mid = at((start + end) / 2);
		const deviation = Math.hypot(mid[0] - (a[0] + b[0]) / 2, mid[1] - (a[1] + b[1]) / 2);
		const scale = railDistance(a, b) / (unit * n);
		return {
			a,
			b,
			length: end - start,
			small: n === 1,
			fits: scale >= 1 - 1e-8 && scale <= 1.15 && deviation <= 0.029
		};
	}
	const result = [];
	for (let i = 0; i < count;) {
		const full = i + 4 <= count ? bay(i, 4) : undefined;
		if (full?.fits) {
			result.push(full);
			i += 4;
		} else {
			result.push(bay(i, 1));
			i++;
		}
	}
	return result;
}
