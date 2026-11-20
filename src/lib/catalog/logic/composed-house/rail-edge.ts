import { chainage, pathPoint } from '../linear-path';
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

/** Samples the concentric tread edge in equal arc-length bays, retaining every turn station. */
export function edgeBays(legs: RailLeg[], offset: number, spacing: number) {
	const last = legs[legs.length - 1];
	const points = legs.flatMap((l) => stations(l, offset));
	points.push([
		last.b.xy[0] + offset * last.b.normal[0],
		last.b.xy[1] + offset * last.b.normal[1],
		last.low
	]);
	points.reverse();
	const distances = chainage(points),
		length = distances[distances.length - 1],
		count = Math.ceil(length / spacing);
	let next = 1;
	return Array.from({ length: count }, (_, i) => {
		const start = (length * i) / count,
			end = (length * (i + 1)) / count;
		const path = [pathPoint(points, distances, start)];
		while (next < points.length - 1 && distances[next] < end - 1e-9) {
			if (distances[next] > start + 1e-9) path.push(points[next]);
			next++;
		}
		path.push(pathPoint(points, distances, end));
		return { path, length: end - start };
	});
}
