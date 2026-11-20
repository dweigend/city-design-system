import { Box2, Vector2, Vector3 } from 'three/webgpu';
import { bounds } from '../../logic/ansicht/geometrie';
import type { Primitive } from '../../logic/parametrik/types';
import type { World } from '../../logic/sandbox';
import { lineParts } from '../../logic/transit-line';
import { roundedStops } from './station-rings';
import type { OpeningArea, View } from './view';

function corners(part: Primitive) {
	const { min, max } = bounds(part);
	return [min[0], max[0]].flatMap((x) =>
		[min[1], max[1]].flatMap((y) => [min[2], max[2]].map((z) => new Vector3(x, z, -y)))
	);
}

// Project bends individually so the corners of an empty bend don't enlarge the route silhouette.
function partCorners(part: Primitive) {
	if (part.kind !== 'pipe') return corners(part);
	return part.points
		.slice(1)
		.flatMap((end, i) => corners({ ...part, points: [part.points[i], end] }));
}

function landmarkBounds(world: World, additions: readonly Primitive[]) {
	const routes = world.lines.map((line) => roundedStops(lineParts(line)));
	return [...routes, additions]
		.filter((group) => group.length)
		.map((group) => group.flatMap(partCorners));
}

function rect(x: number, y: number, right: number, bottom: number) {
	return new Box2(new Vector2(x, y), new Vector2(right, bottom));
}

function openingZones(view: View, area?: OpeningArea) {
	const [w, h] = view.viewport(),
		right = area?.right ?? w,
		top = area?.top ?? 0,
		bottom = area?.bottom ?? h;
	return {
		canvas: rect(0, 0, w, h).expandByScalar(4),
		safe: rect(0, top, right, bottom).expandByScalar(-4),
		foreground: rect(0, top + (bottom - top) * 0.55, right * 0.55, bottom)
	};
}

function projectedBox(view: View, group: Vector3[]) {
	const box = new Box2();
	for (const p of group) {
		const { x, y } = view.project([p.x, -p.z, p.y]);
		box.expandByPoint(new Vector2(x, y));
	}
	return box;
}

function violations(
	view: View,
	groups: Vector3[][],
	zones: ReturnType<typeof openingZones>,
	others: Vector3[][]
) {
	let score = 0;
	for (const group of groups) {
		const box = projectedBox(view, group);
		if (!zones.canvas.intersectsBox(box)) continue;
		if (view.isPortrait() || !zones.safe.containsBox(box)) score += groups.length + 1;
		if (zones.foreground.intersectsBox(box)) score++;
	}
	for (const group of others) {
		const box = projectedBox(view, group);
		if (zones.canvas.intersectsBox(box) && !zones.safe.containsBox(box)) score += groups.length + 1;
	}
	return score;
}

/** Keeps whole landmark envelopes clear of crop edges and the phone canvas while fitting occupied courts. */
export function frameOccupiedCourts(
	view: View,
	world: World,
	courts: { points: Vector3[]; others: Vector3[][]; heading: number },
	area?: OpeningArea,
	additions: readonly Primitive[] = []
) {
	const groups = landmarkBounds(world, additions),
		zones = openingZones(view, area);
	const fit = (heading: number) =>
		view.frameSilhouette(courts.points, undefined, area, [], heading);
	let best = courts.heading,
		lowest = Infinity,
		smallest = Infinity;
	for (let offset = 0; offset < 360; offset += 5) {
		const heading = courts.heading + (offset * Math.PI) / 180;
		fit(heading);
		const score = violations(view, groups, zones, courts.others);
		if (score < lowest || (score === lowest && view.span() < smallest - 0.01)) {
			lowest = score;
			smallest = view.span();
			best = heading;
		}
	}
	fit(best);
}
