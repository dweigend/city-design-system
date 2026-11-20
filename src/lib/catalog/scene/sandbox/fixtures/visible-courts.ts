import { courtOpening } from '../court-opening';
import type { View, OpeningArea } from '../view';
import type { World } from '../../../logic/sandbox';

/** Whole court envelopes inside a camera's unobstructed opening. */
export function visibleCourts(world: World, view: View, area?: OpeningArea) {
	const [width, height] = view.viewport();
	const right = area?.right ?? width,
		top = area?.top ?? 0,
		bottom = area?.bottom ?? height;
	return courtOpening(world)
		.map((c) => [...c.points, ...c.houses.flat()].map((p) => view.project([p.x, -p.z, p.y])))
		.filter((points) =>
			points.every((p) => p.x >= (area?.left ?? 0) && p.x <= right && p.y >= top && p.y <= bottom)
		);
}
