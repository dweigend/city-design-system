import type { Vec2 } from '../../core/geometry';
import { clipPolylineToSquare } from '../../core/polyline';
import type { Valley } from '../../domain/valley';
import { VALLEY_MEASUREMENT_PROTOCOL } from '../../world/valley-protocol';

export type ValleyWindow = Readonly<{
	origin: Vec2;
	bearing: number;
	length: number;
	width: number;
}>;

export function windowFrame(valley: Valley, { origin: [cx, cy], bearing, length }: ValleyWindow) {
	const fx = Math.cos(bearing);
	const fy = Math.sin(bearing);
	const toLocal = (x: number, y: number): Vec2 => [
		(x - cx) * fx + (y - cy) * fy,
		(y - cy) * fx - (x - cx) * fy
	];
	const toWorld = (x: number, y: number): Vec2 => [cx + x * fx - y * fy, cy + x * fy + y * fx];
	return {
		length,
		xy: valley.course.xy,
		toLocal,
		toWorld,
		sample(x: number, y: number) {
			return valley.sampleGround(...toWorld(x, y));
		}
	};
}

export type ReachFrame = ReturnType<typeof windowFrame>;

export function reachFrame(valley: Valley, width: number) {
	const reach = clipPolylineToSquare(valley.course.xy, VALLEY_MEASUREMENT_PROTOCOL.regionalWindowM);
	if (!reach) throw new RangeError('The river does not cross the regional window');
	const xy = Object.freeze(Array.from(reach.xy));
	const [startX, startY] = xy;
	const dx = xy[xy.length - 2] - startX;
	const dy = xy[xy.length - 1] - startY;
	const length = Math.hypot(dx, dy);
	const fx = dx / length;
	const fy = dy / length;
	const cx = startX + dx / 2;
	const cy = startY + dy / 2;
	let low = Infinity;
	let high = -Infinity;
	for (let i = 0; i < xy.length; i += 2) {
		const across = (xy[i + 1] - cy) * fx - (xy[i] - cx) * fy;
		low = Math.min(low, across);
		high = Math.max(high, across);
	}
	const offset = (low + high) / 2;
	const frame = windowFrame(valley, {
		origin: [cx - offset * fy, cy + offset * fx],
		bearing: Math.atan2(dy, dx),
		length,
		width
	});
	return { ...frame, xy };
}
