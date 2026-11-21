import type { RiverCourse } from './course';
import { toMillimeters } from './millimeters';

type Bounds = { west: number; east: number; south: number; north: number };
type Interval = Bounds & { start: number; end: number; children?: [Interval, Interval] };

function bounds(xy: Int32Array, start: number, end: number): Bounds {
	let west = Infinity;
	let east = -Infinity;
	let south = Infinity;
	let north = -Infinity;
	for (let index = start; index <= end; index++) {
		west = Math.min(west, xy[2 * index]);
		east = Math.max(east, xy[2 * index]);
		south = Math.min(south, xy[2 * index + 1]);
		north = Math.max(north, xy[2 * index + 1]);
	}
	return { west, east, south, north };
}

function partition(xy: Int32Array, start: number, end: number): Interval {
	const interval = { ...bounds(xy, start, end), start, end };
	if (end - start <= 8) return interval;
	const middle = (start + end) >>> 1;
	return { ...interval, children: [partition(xy, start, middle), partition(xy, middle, end)] };
}

function boxDistanceSquared(box: Bounds, x: number, y: number): number {
	const dx = Math.max(0, box.west - x, x - box.east);
	const dy = Math.max(0, box.south - y, y - box.north);
	return dx * dx + dy * dy;
}

/** Builds a nearest-segment sampler over the course quantized to millimeters. */
export function courseProjection(course: RiverCourse) {
	const xy = Int32Array.from(course.xy, toMillimeters);
	const last = course.chainageM.length - 1;
	const tree = partition(xy, 0, last);
	const originM = course.chainageM[last / 2];

	return (x: number, y: number) => {
		let distanceSquared = Infinity;
		let segment = last;
		let fraction = 0;
		let side = 0;

		function inspect(interval: Interval, bound: number): void {
			if (bound > distanceSquared) return;
			if (interval.children) {
				const [left, right] = interval.children;
				const dl = boxDistanceSquared(left, x, y);
				const dr = boxDistanceSquared(right, x, y);
				if (dl <= dr) {
					inspect(left, dl);
					inspect(right, dr);
				} else {
					inspect(right, dr);
					inspect(left, dl);
				}
				return;
			}
			for (let index = interval.start; index < interval.end; index++) {
				const px = x - xy[2 * index];
				const py = y - xy[2 * index + 1];
				const dx = xy[2 * index + 2] - xy[2 * index];
				const dy = xy[2 * index + 3] - xy[2 * index + 1];
				const t = Math.min(1, Math.max(0, (px * dx + py * dy) / (dx * dx + dy * dy)));
				const alongX = px - t * dx;
				const alongY = py - t * dy;
				const candidate = alongX * alongX + alongY * alongY;
				if (candidate < distanceSquared || (candidate === distanceSquared && index < segment)) {
					distanceSquared = candidate;
					segment = index;
					fraction = t;
					side = Math.sign(dx * py - dy * px);
				}
			}
		}

		inspect(tree, 0);
		const start = course.chainageM[segment];
		const end = course.chainageM[segment + 1];
		return {
			stationMm: toMillimeters(start + fraction * (end - start) - originM),
			offsetMm: side * Math.round(Math.sqrt(distanceSquared))
		};
	};
}
