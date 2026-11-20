import { required } from '../required';
import type { Point, Solid, Plan } from './types';

/** Subdivides tall shaft spans into alternating triangulated bays no higher than a storey. */
export function braceBays(
	plan: Plan,
	id: string,
	stations: number[],
	bottom: number,
	top: number,
	reverse: boolean
) {
	if (plan.site.programme.length <= 8) return [brace(plan, id, stations, bottom, top, reverse)];
	const count = Math.max(1, Math.ceil((top - bottom) / 4));
	const at = (k: number) => bottom + ((top - bottom) * k) / count;
	return Array.from({ length: count }, (_, k) =>
		brace(plan, id + '/lattice/' + k, stations, at(k), at(k + 1), k % 2 ? !reverse : reverse)
	);
}
/** A diagonal flat-ended strut between successive slabs, with its two actual horizontal bearing faces. */
export function brace(
	plan: Plan,
	id: string,
	stations: number[],
	bottom: number,
	top: number,
	reverse: boolean
): Solid {
	const width = 0.3,
		inset = plan.type === 'slab-house' ? 0.75 : plan.bar,
		low = stations[0] + inset,
		end = required(stations.at(-1), 'bearing station') - inset,
		high = [
			'portal-house',
			'bridge-house',
			'rack',
			'deck-tower',
			'bell-house',
			'twin-stack'
		].includes(plan.type)
			? Math.min(end, low + 1.25)
			: end;
	const y = plan.rear - plan.sign * 0.15;
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
		structuralRole: 'bearing',
		joint: 'brace',
		slot: 'frame',
		role: 'neu',
		ground: plan.site.ground,
		size: [high - low + width, width, top - bottom]
	};
}
