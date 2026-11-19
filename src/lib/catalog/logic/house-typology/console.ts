import { worldSize } from './objects';
import type { Block, Level, Plan, Solid } from './types';

/** Cuts away the floor between the console arms. The rear strip carries the landing and bearings. */
export function consolePlate(plan: Plan, level: Level, slab: Block): Solid {
	const [left, bottom, z] = slab.position;
	const [width, depth, height] = slab.size;
	const right = left + width,
		rear = plan.sign > 0 ? bottom + depth : bottom;
	const front = rear - plan.sign * depth;
	const inner = rear - plan.sign * Math.min(1.25, depth / 2);
	const arms = level.bodies
		.map((b) => {
			const half = Math.min(worldSize(b)[0] / 3, width / 4);
			return [Math.max(left, b.position[0] - half), Math.min(right, b.position[0] + half)];
		})
		.sort((a, b) => a[0] - b[0]);
	const merged: number[][] = [];
	for (const arm of arms) {
		const previous = merged.at(-1);
		if (previous && arm[0] <= previous[1]) previous[1] = Math.max(previous[1], arm[1]);
		else merged.push(arm);
	}
	const outline: [number, number][] = [
		[left, rear],
		[left, inner]
	];
	for (const [a, b] of merged) outline.push([a, inner], [a, front], [b, front], [b, inner]);
	outline.push([right, inner], [right, rear]);
	if (plan.sign < 0) outline.reverse();
	return {
		...slab,
		kind: 'prism',
		id: slab.id.replace(/deck$/, 'landing'),
		polygon: outline,
		z,
		height
	};
}
