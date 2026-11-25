import { materialSettings } from '../../../config/material';
import { readVertexMean, type Vec2 } from '../../core/geometry';

/** An axis-aligned rectangle in patch meters: left, bottom, right, top. */
export type Rect = readonly [u0: number, v0: number, u1: number, v1: number];

const { planeToleranceM } = materialSettings;

/** Keeps the part of a convex polygon where `side(point) >= 0` for a linear `side`. */
export function clipHalfPlane(polygon: readonly Vec2[], side: (point: Vec2) => number): Vec2[] {
	const kept: Vec2[] = [];
	for (const [i, a] of polygon.entries()) {
		const b = polygon[(i + 1) % polygon.length];
		const sa = side(a);
		const sb = side(b);
		if (sa >= 0) kept.push(a);
		if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) {
			const t = sa / (sa - sb);
			kept.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
		}
	}
	return dropRepeats(kept);
}

// Exact arithmetic: a triangle needs three corners; area tolerance is the square of the length tolerance.
function dropRepeats(polygon: Vec2[]): Vec2[] {
	const out = polygon.filter((point, i) => {
		const next = polygon[(i + 1) % polygon.length];
		return Math.hypot(point[0] - next[0], point[1] - next[1]) > planeToleranceM;
	});
	return out.length >= 3 && Math.abs(signedArea(out)) > planeToleranceM ** 2 ? out : [];
}

function signedArea(polygon: readonly Vec2[]) {
	let twice = 0;
	for (const [i, [u0, v0]] of polygon.entries()) {
		const [u1, v1] = polygon[(i + 1) % polygon.length];
		twice += u0 * v1 - u1 * v0;
	}
	return twice / 2;
}

/** Clips a convex polygon to a convex counter-clockwise outline; empty when nothing remains. */
export function clipToOutline(polygon: readonly Vec2[], outline: readonly Vec2[]): Vec2[] {
	let result: Vec2[] = [...polygon];
	for (const [i, a] of outline.entries()) {
		if (!result.length) break;
		const b = outline[(i + 1) % outline.length];
		result = clipHalfPlane(
			result,
			([u, v]) => (b[0] - a[0]) * (v - a[1]) - (b[1] - a[1]) * (u - a[0])
		);
	}
	return result;
}

/** A convex rectangle polygon, counter-clockwise. */
export function rectPolygon([u0, v0, u1, v1]: Rect): Vec2[] {
	return [
		[u0, v0],
		[u1, v0],
		[u1, v1],
		[u0, v1]
	];
}

function inside([u, v]: Vec2, [u0, v0, u1, v1]: Rect) {
	return u > u0 && u < u1 && v > v0 && v < v1;
}

/** Splits a convex polygon along every opening edge line that crosses it and drops the cells
 * inside an opening. All cells share one grid, so neighbours meet edge to edge without T-joints. */
// Exact arithmetic: axis indices 0 and 1 of patch coordinates.
export function cutOpenings(polygon: readonly Vec2[], openings: readonly Rect[]): Vec2[][] {
	const [minU, maxU] = [Math.min(...polygon.map(([u]) => u)), Math.max(...polygon.map(([u]) => u))];
	const [minV, maxV] = [
		Math.min(...polygon.map(([, v]) => v)),
		Math.max(...polygon.map(([, v]) => v))
	];
	const overlapping = openings.filter(
		([u0, v0, u1, v1]) => u0 < maxU && u1 > minU && v0 < maxV && v1 > minV
	);
	if (!overlapping.length) return [[...polygon]];
	const lines = (axis: 0 | 1, low: number, high: number) =>
		[...new Set(overlapping.flatMap((rect) => [rect[axis], rect[axis + 2]]))]
			.filter((x) => x > low && x < high)
			.sort((a, b) => a - b);
	const us = [minU, ...lines(/* Exact arithmetic: U axis index. */ 0, minU, maxU), maxU];
	const vs = [minV, ...lines(/* Exact arithmetic: V axis index. */ 1, minV, maxV), maxV];
	const cells: Vec2[][] = [];
	for (let i = 0; i + 1 < us.length; i++) {
		for (let j = 0; j + 1 < vs.length; j++) {
			const cell = clipToOutline(polygon, rectPolygon([us[i], vs[j], us[i + 1], vs[j + 1]]));
			if (!cell.length) continue;
			const center = readVertexMean(cell);
			if (!overlapping.some((rect) => inside(center, rect))) cells.push(cell);
		}
	}
	return cells;
}

/** Parts of the segment from a to b that lie outside every opening. */
// Exact arithmetic: the segment parameter runs from 0 to 1.
export function segmentOutside(a: Vec2, b: Vec2, openings: readonly Rect[]): [Vec2, Vec2][] {
	let spans: [number, number][] = /* Exact arithmetic: whole segment interval. */ [[0, 1]];
	for (const [u0, v0, u1, v1] of openings) {
		const [enter, exit] = slab(a, b, [u0, v0, u1, v1]);
		if (enter >= exit) continue;
		spans = spans.flatMap(
			([s, e]): [number, number][] =>
				[
					[s, Math.min(e, enter)],
					[Math.max(s, exit), e]
				].filter(([x, y]) => y - x > planeToleranceM) as [number, number][]
		);
	}
	const at = (t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
	return spans.map(([s, e]) => [at(s), at(e)]);
}

/** Parameter interval of the segment strictly inside an axis-aligned rectangle. */
// Exact arithmetic: axis indices and the empty interval [1, 0].
function slab(a: Vec2, b: Vec2, rect: Rect): [number, number] {
	let enter = 0;
	let exit = 1;
	for (const axis of /* Exact arithmetic: UV coordinate indices. */ [0, 1] as const) {
		const delta = b[axis] - a[axis];
		const [low, high] = [rect[axis], rect[axis + 2]];
		if (Math.abs(delta) <= planeToleranceM) {
			if (a[axis] <= low || a[axis] >= high)
				return /* Exact arithmetic: empty clipping interval. */ [1, 0];
			continue;
		}
		const t0 = (low - a[axis]) / delta;
		const t1 = (high - a[axis]) / delta;
		enter = Math.max(enter, Math.min(t0, t1));
		exit = Math.min(exit, Math.max(t0, t1));
	}
	return [enter, exit];
}
