import { cameraScore } from './opening-score';
import { Box2, Box3, Vector2, Vector3 } from 'three/webgpu';
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

type Courts = ReturnType<typeof courtOpening>;

function neighbourhoods(courts: Courts) {
	// Exhaust the small opening town. For an expanded city, bound the search to neighbours.
	if (courts.length <= 8) {
		let sets: number[][] = [[]];
		for (const i of courts.keys()) sets = sets.concat(sets.map((indices) => [...indices, i]));
		return sets.slice(1);
	}
	const centers = courts.map((c) => new Box3().setFromPoints(c.points).getCenter(new Vector3()));
	const groups = new Map<string, number[]>();
	for (const center of centers) {
		const nearest = centers
			.map((p, i) => ({ i, d: p.distanceToSquared(center) }))
			.sort((a, b) => a.d - b.d);
		for (let count = 1; count <= nearest.length; count++) {
			const indices = nearest
				.slice(0, count)
				.map((p) => p.i)
				.sort((a, b) => a - b);
			groups.set(indices.join(','), indices);
		}
	}
	return [...groups.values()];
}

// All candidate crops at a heading are affine transforms of one orthographic projection.
function projector(view: View) {
	const [w, h] = view.viewport(),
		unit = view.metersPerPixel(),
		p = new Vector3(),
		q = new Vector2();
	return (points: Vector3[]) => {
		const box = new Box2();
		for (const corner of points) {
			p.copy(corner).project(view.camera);
			box.expandByPoint(q.set((p.x * w * unit) / 2, (-p.y * h * unit) / 2));
		}
		return box;
	};
}

function screenBounds(view: View, area?: OpeningArea) {
	const [w, h] = view.viewport();
	const safe = rect(0, area?.top ?? 0, area?.right ?? w, area?.bottom ?? h);
	const reserved = (area?.reserved ?? []).map((r) => rect(r.left, r.top, r.right, r.bottom));
	const foreground = rect(
		0,
		safe.min.y + 0.55 * (safe.max.y - safe.min.y),
		safe.max.x * 0.55,
		safe.max.y
	);
	return { canvas: rect(0, 0, w, h), safe, reserved, foreground };
}

function compare(a: number[], b: number[]) {
	for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-6) return a[i] - b[i];
	return 0;
}

function projectScene(view: View, courts: Courts, landmarks: Vector3[][], stock: Vector3[][]) {
	const project = projector(view);
	const houses = courts.map((c) => (c.houses.length ? c.houses.map(project) : [project(c.points)]));
	return {
		courts: courts.map((c, i) => houses[i].reduce((box, h) => box.union(h), project(c.points))),
		houses,
		landmarks: landmarks.map(project),
		stock: stock.map(project)
	};
}

/** Fits readable houses first, comparing whole occupied neighbourhoods at the current viewport size. */
export function frameOccupiedCourts(
	view: View,
	world: World,
	courts: Courts,
	area?: OpeningArea,
	additions: readonly Primitive[] = []
) {
	const groups = neighbourhoods(courts),
		landmarks = landmarkBounds(world, additions),
		stock = stockBounds(world);
	const screen = screenBounds(view, area);
	let best = groups[0],
		azimuth = 0,
		score: number[] = [];
	for (let degrees = 0; degrees < 360; degrees += 2.5) {
		const heading = (degrees * Math.PI) / 180;
		view.frameSilhouette([courts[0].points[0]], undefined, area, [], heading);
		const data = projectScene(view, courts, landmarks, stock);
		for (const group of groups) {
			const rank = cameraScore(view, screen, group, data);
			if (rank && (!score.length || compare(rank, score) > 0)) {
				score = rank;
				best = group;
				azimuth = heading;
			}
		}
	}
	if (!score.length) return false;
	view.frameSilhouette(
		best.flatMap((i) => [...courts[i].points, ...courts[i].houses.flat()]),
		undefined,
		area,
		[],
		azimuth
	);
	return true;
}
