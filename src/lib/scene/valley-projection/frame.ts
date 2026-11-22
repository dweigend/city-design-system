import { clipPolylineToSquare } from '../../core/polyline';
import type { Valley } from '../../domain/valley';

export function reachFrame(valley: Valley) {
	const reach = clipPolylineToSquare(valley.course.xy, 8000);
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
	const vertices = [];
	let minAcross = Infinity;
	let maxAcross = -Infinity;
	for (let i = 0; i < xy.length; i += 2) {
		const x = xy[i] - cx;
		const y = xy[i + 1] - cy;
		const across = y * fx - x * fy;
		minAcross = Math.min(minAcross, across);
		maxAcross = Math.max(maxAcross, across);
		vertices.push([x * fx + y * fy, across] as const);
	}
	const offset = (minAcross + maxAcross) / 2;
	return {
		length,
		xy,
		course: vertices.map(([x, y]) => [x, y - offset] as const),
		sample(x: number, y: number) {
			return valley.sampleGround(cx + x * fx - (y + offset) * fy, cy + x * fy + (y + offset) * fx);
		}
	};
}

export type ReachFrame = ReturnType<typeof reachFrame>;

export function trackRiver(course: ReachFrame['course']) {
	let index = 0;
	return (x: number) => {
		while (index < course.length - 2 && course[index + 1][0] < x) index++;
		const [ax, ay] = course[index];
		const [bx, by] = course[index + 1];
		const t = Math.max(0, Math.min(1, (x - ax) / (bx - ax)));
		return ay + t * (by - ay);
	};
}
