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

// Keep route bends separate. A box around an entire line also covers the empty land inside a bend.
function envelopes(part: Primitive) {
	if (part.kind !== 'pipe') return [corners(part)];
	return part.points.slice(1).map((b, i) => corners({ ...part, points: [part.points[i], b] }));
}

function rect(x: number, y: number, right: number, bottom: number) {
	return new Box2(new Vector2(x, y), new Vector2(right, bottom));
}

function obstructionCost(view: View, objects: Vector3[][], reserved: Box2[]) {
	const [w, h] = view.viewport();
	let cost = 0;
	const projected = new Vector3();
	for (const corners of objects) {
		const box = new Box2();
		for (const p of corners) {
			projected.copy(p).project(view.camera);
			box.expandByPoint(new Vector2(((projected.x + 1) * w) / 2, ((1 - projected.y) * h) / 2));
		}
		for (const zone of reserved) {
			const size = box.clone().intersect(zone).getSize(new Vector2());
			cost += size.x * size.y;
		}
	}
	return cost;
}

/** Fits houses at each candidate heading and chooses the least obstructed desktop foreground. */
export function frameDesktopCourts(
	view: View,
	world: World,
	courts: { points: Vector3[]; heading: number },
	area?: OpeningArea,
	additions: readonly Primitive[] = []
) {
	const [w, h] = view.viewport();
	const right = area?.right ?? w,
		bottom = area?.bottom ?? h,
		top = area?.top ?? 0;
	const zones = [
		rect(0, bottom, w, h),
		rect(right, 0, w, h),
		rect(0, 0, w, top),
		rect(0, top + (bottom - top) * 0.55, right * 0.55, bottom)
	];
	const fixtures = world.lines.flatMap((line) => roundedStops(lineParts(line))).concat(additions);
	const objects = fixtures.flatMap(envelopes);
	let best = courts.heading,
		lowest = Infinity;
	const fit = (heading: number) =>
		view.frameSilhouette(courts.points, undefined, area, [], heading);
	for (const degrees of [0, 180, -25, 25, 155, 205, -50, 50, 130, 230]) {
		const heading = courts.heading + (degrees * Math.PI) / 180;
		fit(heading);
		const cost = obstructionCost(view, objects, zones);
		if (cost < lowest) {
			best = heading;
			lowest = cost;
		}
		if (cost === 0) break;
	}
	fit(best);
}
