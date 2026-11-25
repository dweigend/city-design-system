import {
	booleanOpWithPolyTree,
	ClipType,
	FillRule,
	PolyTree64,
	type Path64,
	type PolyPath64
} from 'clipper2-ts';
import { distance, measurePolygon, type Vec2 } from '../../core/geometry';
import type { PlanPolygon } from './types';

function comparePoint([ax, ay]: Vec2, [bx, by]: Vec2) {
	return ax - bx || ay - by;
}

function readRing(path: Path64, origin: Vec2, quantumM: number) {
	const ring = path.map(({ x, y }): Vec2 =>
		Object.freeze([origin[0] + x * quantumM, origin[1] + y * quantumM])
	);
	const start = ring.reduce(
		(first, point, i) => (comparePoint(point, ring[first]) < 0 ? i : first),
		0
	);
	return Object.freeze([...ring.slice(start), ...ring.slice(0, start)]);
}

function readPolygons(tree: PolyTree64, origin: Vec2, quantumM: number) {
	const polygons: PlanPolygon[] = [];
	const ring = (node: PolyPath64) => readRing(node.polygon ?? [], origin, quantumM);
	function visit(parent: PolyPath64) {
		for (let i = 0; i < parent.count; i++) {
			const outer = parent.child(i);
			const holes = Array.from({ length: outer.count }, (_, j) => outer.child(j));
			const inside = holes.map(ring).sort((a, b) => comparePoint(a[0], b[0]));
			polygons.push(Object.freeze([ring(outer), ...inside]));
			for (const hole of holes) visit(hole);
		}
	}
	visit(tree);
	return polygons.sort((a, b) => comparePoint(a[0][0], b[0][0]));
}

function clip(
	type: ClipType,
	subject: PlanPolygon,
	clips: readonly PlanPolygon[],
	toleranceM: number
) {
	const origin = subject[0][0];
	// Each axis rounds to the nearest lattice point. Keep the quantum smaller than the
	// contact tolerance to leave room for rounding on both intersecting coordinates.
	const quantumM = toleranceM / (2 * 2);
	const encode = (polygon: PlanPolygon): Path64[] =>
		polygon.map((ring) =>
			ring.map(([x, y]) => ({
				x: Math.round((x - origin[0]) / quantumM),
				y: Math.round((y - origin[1]) / quantumM)
			}))
		);
	const result = new PolyTree64();
	booleanOpWithPolyTree(type, encode(subject), clips.flatMap(encode), result, FillRule.NonZero);
	return readPolygons(result, origin, quantumM);
}

export function subtract(subject: PlanPolygon, clips: readonly PlanPolygon[], toleranceM: number) {
	return clips.length ? clip(ClipType.Difference, subject, clips, toleranceM) : [subject];
}

export function intersect(a: PlanPolygon, b: PlanPolygon, toleranceM: number) {
	return clip(ClipType.Intersection, a, [b], toleranceM);
}

export function polygonArea(polygon: PlanPolygon) {
	return polygon.reduce((sum, ring) => sum + measurePolygon(ring).area, 0);
}

export function edgeFrame(a: Vec2, b: Vec2) {
	const lengthM = distance(a, b);
	const dx = (b[0] - a[0]) / lengthM;
	const dy = (b[1] - a[1]) / lengthM;
	return {
		lengthM,
		pointAt: (along: number, left: number): Vec2 =>
			Object.freeze([a[0] + along * dx - left * dy, a[1] + along * dy + left * dx]),
		read: ([x, y]: Vec2): Vec2 => [
			(x - a[0]) * dx + (y - a[1]) * dy,
			(y - a[1]) * dx - (x - a[0]) * dy
		]
	};
}

export function rectangle(
	frame: ReturnType<typeof edgeFrame>,
	start: number,
	end: number,
	near: number,
	far: number
): PlanPolygon {
	return [
		[
			frame.pointAt(start, near),
			frame.pointAt(end, near),
			frame.pointAt(end, far),
			frame.pointAt(start, far)
		]
	];
}

/** Intersections of a ring with a line perpendicular to the supporting edge at alongM. */
export function lineHits(projected: readonly Vec2[], alongM: number) {
	return projected.flatMap(([a, u], edge) => {
		const [b, v] = projected[(edge + 1) % projected.length];
		if (a > alongM === b > alongM) return [];
		return [{ edge, left: u + (v - u) * ((alongM - a) / (b - a)) }];
	});
}
