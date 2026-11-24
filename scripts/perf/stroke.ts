import type { Vec2 } from '../../src/lib/core/geometry';
import { projectFocus } from '../../src/lib/scene/stage';
import type { townFixtures } from './pipeline';

export type CanvasBox = { x: number; y: number; width: number; height: number };

/** Finds an in-bounds raster path using the same polygon index as pointer events. */
export function strokePath(
	{ world, projection, points }: ReturnType<typeof townFixtures>,
	box: CanvasBox,
	stageWidth: number,
	target: number
) {
	const focus = projectFocus('plan', {}, points);
	if (!focus) throw new Error('Missing sandbox focus for the plan stroke');
	const scale = stageWidth / Math.round(box.width);
	const [x, y] = focus.center;
	const toWorld = ([px, py]: Vec2) =>
		projection.toWorld(
			x + (px - box.x - box.width / 2) * scale,
			y - (py - box.y - box.height / 2) * scale
		);
	const left = Math.round(box.x + box.width * 0.22);
	const right = Math.round(box.x + box.width * 0.78);
	const path: Vec2[] = [];
	const ids = new Set<string>();
	const hover = new Map<string, Vec2>();
	let last: Vec2 | undefined;
	const append = (point: Vec2, corner = false) => {
		const previous = last;
		const at = toWorld(point);
		const first = world.polygons.readPoint(at);
		const hits = previous
			? world.polygons.readSegment(toWorld(previous), at)
			: first
				? [first]
				: [];
		const added = hits.filter(({ id, publicUse }) => !publicUse && !ids.has(id));
		if (ids.size + added.length > target && previous) {
			const [a, b] = previous;
			const midpoint: Vec2 = [Math.round((a + point[0]) / 2), Math.round((b + point[1]) / 2)];
			if (
				(midpoint[0] === a && midpoint[1] === b) ||
				(midpoint[0] === point[0] && midpoint[1] === point[1])
			)
				throw new Error('Stroke crosses two parcels within one pixel of its endpoint');
			append(midpoint);
			if (ids.size < target) append(point, corner);
			return;
		}
		for (const { id } of added) ids.add(id);
		if (first && !first.publicUse && !hover.has(first.id)) hover.set(first.id, point);
		if (!previous || added.length || corner) path.push(point);
		last = point;
	};
	const stride = 15;
	for (let row = 0.48; row <= 0.82; row += 0.05) {
		const py = Math.round(box.y + box.height * row);
		const forward = path.at(-1)?.[0] !== right;
		const span = Math.ceil((right - left) / stride);
		for (let i = 0; i <= span; i++) {
			const offset = Math.round((i * (right - left)) / span);
			append([forward ? left + offset : right - offset, py], i === 0 || i === span);
			if (ids.size === target) return { path, hover: [...hover.values()] };
		}
	}
	throw new Error(`Only ${ids.size} parcels fit on the paint path`);
}
