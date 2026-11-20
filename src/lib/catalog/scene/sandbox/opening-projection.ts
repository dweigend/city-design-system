import { Box2, Vector2, Vector3 } from 'three/webgpu';
import { boxCorners, type courtOpening, stockBounds } from './court-opening';
import { bounds } from '../../logic/ansicht/geometrie';
import type { Primitive } from '../../logic/parametrik/types';
import type { World } from '../../logic/sandbox';
import { lineParts } from '../../logic/transit-line';
import { roundedStops } from './station-rings';
import type { OpeningArea, View } from './view';

function corners(part: Primitive) {
	return boxCorners(bounds(part));
}

function landmarkBounds(world: World, additions: readonly Primitive[]) {
	const routes = world.lines.map((line) => roundedStops(lineParts(line)));
	return [...routes, additions]
		.filter((group) => group.length)
		.map((group) => group.flatMap(corners));
}

function rect(x: number, y: number, right: number, bottom: number) {
	return new Box2(new Vector2(x, y), new Vector2(right, bottom));
}

export type OpeningProjection = ReturnType<typeof projectScene>;
export type OpeningScreen = ReturnType<typeof screenBounds>;

export type Courts = ReturnType<typeof courtOpening>;

// All candidate crops at a heading are affine transforms of one orthographic projection.
function projector(view: View) {
	const m = view.camera.matrixWorld.elements;
	const x0 = m[12] * m[0] + m[13] * m[1] + m[14] * m[2];
	const y0 = m[12] * m[4] + m[13] * m[5] + m[14] * m[6];
	return (points: Vector3[]) => {
		let left = Infinity,
			top = Infinity,
			right = -Infinity,
			bottom = -Infinity;
		for (const { x, y, z } of points) {
			const u = x * m[0] + y * m[1] + z * m[2] - x0;
			const v = y0 - x * m[4] - y * m[5] - z * m[6];
			left = Math.min(left, u);
			right = Math.max(right, u);
			top = Math.min(top, v);
			bottom = Math.max(bottom, v);
		}
		return rect(left, top, right, bottom);
	};
}

/** Canvas, usable image and HUD rectangles in CSS pixels. */
export function screenBounds(view: View, area?: OpeningArea) {
	const [w, h] = view.viewport();
	const safe = rect(area?.left ?? 0, area?.top ?? 0, area?.right ?? w, area?.bottom ?? h);
	const reserved = (area?.reserved ?? []).map((r) => rect(r.left, r.top, r.right, r.bottom));
	if (safe.min.y > 0) reserved.push(rect(0, 0, w, safe.min.y));
	const foreground = rect(
		0,
		safe.min.y + 0.55 * (safe.max.y - safe.min.y),
		safe.max.x * 0.55,
		safe.max.y
	);
	return { canvas: rect(0, 0, w, h), safe, reserved, foreground };
}

/** Projects every geometric constraint on the current orthographic axes in metres. */
export function projectScene(
	view: View,
	courts: Courts,
	surroundings: ReturnType<typeof surveyContext>
) {
	const project = projector(view);
	const houses = courts.map((c) => (c.houses.length ? c.houses.map(project) : [project(c.points)]));
	return {
		courts: courts.map((c, i) =>
			houses[i].reduce((box, h) => box.union(h), view.isPortrait() ? project(c.points) : new Box2())
		),
		houses,
		landmarks: surroundings.landmarks.map(project),
		stock: surroundings.stock.map(project),
		landscape: surroundings.landscape.map(project)
	};
}

/** Measures stock, complete landmarks and water or green cells around the courts. */
function measureContext(world: World, additions: readonly Primitive[]) {
	let waterCells = 0;
	const landscape = world.grid.cells
		.filter(
			(cell) =>
				(cell.zone === 'water' && waterCells++ % 7 === 0) ||
				['forest', 'meadow'].includes(world.state.cover.get(cell.id) ?? '')
		)
		.map((cell) => cell.corners.map(([x, y, z]) => new Vector3(x, z, -y)));
	return { landmarks: landmarkBounds(world, additions), stock: stockBounds(world), landscape };
}

const contexts = new WeakMap<
	World,
	{ additions: readonly Primitive[]; geometry: ReturnType<typeof measureContext> }
>();
/** Reuses measured context for resize and HUD changes in the same opening world. */
export function surveyContext(world: World, additions: readonly Primitive[]) {
	const previous = contexts.get(world);
	if (
		previous &&
		(previous.additions === additions || (!previous.additions.length && !additions.length))
	)
		return previous.geometry;
	const geometry = measureContext(world, additions);
	contexts.set(world, { additions, geometry });
	return geometry;
}
const oriented = new WeakMap<
	ReturnType<typeof surveyContext>,
	Map<string, OpeningProjection>
>();
/** Caches per-orientation silhouettes for fixed world-origin camera axes, independent of HUD and zoom. */
export function orientedProjection(
	view: View,
	courts: Courts,
	geometry: ReturnType<typeof surveyContext>,
	heading: number
) {
	const key = heading + '/' + view.elevation() + '/' + view.isPortrait();
	const cache = oriented.get(geometry) ?? new Map<string, OpeningProjection>();
	const existing = cache.get(key);
	if (existing) return existing;
	const data = projectScene(view, courts, geometry);
	cache.set(key, data);
	oriented.set(geometry, cache);
	return data;
}
