import { required } from '../required';
import type { Point, Solid, Plan } from './types';

/** A diagonal flat-ended strut between successive slabs, with its two actual horizontal bearing faces. */
export function brace(
	plan: Plan,
	id: string,
	stations: number[],
	bottom: number,
	top: number,
	reverse: boolean
): Solid {
	const width = Math.min(0.12, plan.bar),
		inset = plan.bar,
		low = stations[0] + inset,
		high = required(stations.at(-1), 'bearing station') - inset;
	const y = plan.rear - plan.sign * (plan.type === 'slab-house' ? 0.45 : 0.15);
	const points: Point[] = [];
	for (const [x, z] of [
		[reverse ? high : low, bottom],
		[reverse ? low : high, top]
	]) {
		for (const [u, v] of [
			[-1, -1],
			[1, -1],
			[1, 1],
			[-1, 1]
		])
			points.push([x + (u * width) / 2, y + (v * width) / 2, z]);
	}
	const triangles = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7];
	for (let i = 0; i < 4; i++) {
		const j = (i + 1) % 4;
		triangles.push(i, j, j + 4, i, j + 4, i + 4);
	}
	return {
		id,
		kind: 'mesh',
		points,
		triangles,
		lines: [],
		joint: 'brace',
		slot: 'frame',
		role: 'neu',
		ground: plan.site.ground,
		size: [high - low + width, width, top - bottom]
	};
}
