import { isConvexCounterclockwise, type Vec2 } from '../../core/geometry';
import { encodeKey, encodePair } from '../../core/ref';
import { defaults } from '../../../config/cell-space';
import { doubleArea, type KeyedRing } from './split';
import type { Parcel } from './types';

const {
	stripTargetEdgeM,
	stripMinimumCells,
	stripMaximumCells,
	stripMinimumWidthM,
	stripStraightSineRatio,
	stripSnapRetries,
	stripAreaToleranceRatio,
	stripAreaToleranceM2
} = defaults;

/** Strip counts of a parcel: columns along the frontage and depth rows. */
export type StripCounts = Readonly<{ columns: number; rows: number }>;

/** One parcel side as a corner chain in the direction its parameter grows, with arc-length
 * parameters from 0 to 1. `forward` is true when that direction is counterclockwise. */
type Chain = Readonly<{
	corners: readonly number[];
	params: readonly number[];
	forward: boolean;
}>;

type Frame = Readonly<{
	keys: readonly string[];
	points: readonly Vec2[];
	edge: (from: number) => string;
	seams?: ReadonlySet<string>;
	front: Chain;
	right: Chain;
	rear: Chain;
	left: Chain;
}>;

const lerp = ([ax, ay]: Vec2, [bx, by]: Vec2, t: number): Vec2 => [
	ax + (bx - ax) * t,
	ay + (by - ay) * t
];
const span = ([ax, ay]: Vec2, [bx, by]: Vec2) => Math.hypot(bx - ax, by - ay);

/** Sine of the turn at corner `at` of a ring: positive left (convex), negative right. */
function turnSine(points: readonly Vec2[], at: number): number {
	const n = points.length;
	const [a, b, c] = [points[(at + n - 1) % n], points[at], points[(at + 1) % n]];
	const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
	return cross / (span(a, b) * span(b, c));
}

// Exact arithmetic: cumulative lengths normalised by their total.
function chain(points: readonly Vec2[], corners: readonly number[], forward: boolean): Chain {
	const lengths = corners.map((k, i) => (i ? span(points[corners[i - 1]], points[k]) : 0));
	const total = lengths.reduce((sum, length) => sum + length, 0);
	let run = 0;
	const params = lengths.map((length) => {
		run += length;
		return total > 0 ? run / total : 0;
	});
	return { corners, params, forward };
}

const chainLength = (f: Frame, c: Chain) =>
	c.corners.reduce((sum, k, i) => (i ? sum + span(f.points[c.corners[i - 1]], f.points[k]) : 0), 0);

/** Splits the ring into front, right, rear and left sides. The right side runs from the frontage's
 * end through every corner that turns less than the straight sine, the left side likewise back
 * from its start; what remains between them is the rear (a single corner for a triangle). */
// Exact arithmetic: ring indices.
function frame(
	parcel: Parcel,
	edge: (from: number) => string,
	seams?: ReadonlySet<string>
): Frame | undefined {
	const n = parcel.corners.length;
	const points = parcel.corners.map(({ position }) => position);
	const primary = parcel.frontage.toSorted()[0];
	const start = parcel.corners.findIndex((_, i) => edge(i) === primary);
	if (start < 0) return undefined;
	const at = (k: number) => (start + k + n) % n;
	const straight = (k: number) => Math.abs(turnSine(points, at(k))) < stripStraightSineRatio;
	let c = /* Exact arithmetic: first corner after the frontage endpoints. */ 2;
	while (c < n - 1 && straight(c)) c += /* Exact arithmetic: next corner index. */ 1;
	let d = n - 1;
	while (d > c && straight(d)) d -= /* Exact arithmetic: previous corner index. */ 1;
	const range = (from: number, to: number) =>
		Array.from({ length: to - from + 1 }, (_, k) => at(from + k));
	return {
		keys: parcel.corners.map(({ id }) => encodeKey(['orig', id])),
		points,
		edge,
		seams,
		front: chain(
			points,
			[
				at(/* Exact arithmetic: first frontage endpoint. */ 0),
				at(/* Exact arithmetic: second frontage endpoint. */ 1)
			],
			true
		),
		right: chain(
			points,
			range(/* Exact arithmetic: start after the frontage origin. */ 1, c),
			true
		),
		rear: chain(points, range(c, d).reverse(), false),
		left: chain(
			points,
			[at(/* Exact arithmetic: first frontage endpoint. */ 0), ...range(d, n - 1).reverse()],
			false
		)
	};
}

function chainAt(f: Frame, c: Chain, t: number): Vec2 {
	const i = c.params.findIndex((s) => s >= t);
	if (i <= 0) return f.points[c.corners[Math.max(0, i)]];
	const [t0, t1] = [c.params[i - 1], c.params[i]];
	return lerp(
		f.points[c.corners[i - 1]],
		f.points[c.corners[i]],
		t1 > t0 ? (t - t0) / (t1 - t0) : 0
	);
}

/** The parcel edge under the chain between two parameters. */
// Exact arithmetic: the mid parameter of two points.
function chainEdge(f: Frame, c: Chain, t0: number, t1: number): string | null {
	if (c.corners.length < 2) return null;
	const mid = (t0 + t1) / 2;
	const s = Math.max(
		1,
		c.params.findIndex((t) => t >= mid)
	);
	return f.edge(c.forward ? c.corners[s - 1] : c.corners[s]);
}

/** Coons patch point at (u along the frontage, v into the depth) over the four parcel sides. */
// Exact arithmetic: bilinear blending weights.
function patchPoint(f: Frame, u: number, v: number): Vec2 {
	const corner = (c: Chain, end: boolean) => f.points[c.corners[end ? c.corners.length - 1 : 0]];
	const [A, B, C, D] = [
		corner(f.front, false),
		corner(f.front, true),
		corner(f.rear, true),
		corner(f.rear, false)
	];
	const sides = [
		chainAt(f, f.front, u),
		chainAt(f, f.rear, u),
		chainAt(f, f.left, v),
		chainAt(f, f.right, v)
	];
	const weights = [1 - v, v, 1 - u, u];
	const blend = (k: number) =>
		(1 - u) * (1 - v) * A[k] + u * (1 - v) * B[k] + (1 - u) * v * D[k] + u * v * C[k];
	return /* Exact arithmetic: strip endpoints. */ [0, 1].map(
		(k) => sides.reduce((sum, side, s) => sum + weights[s] * side[k], 0) - blend(k)
	) as unknown as Vec2;
}

type Grid = Readonly<{
	id: string;
	breaks: readonly number[];
	snapped: ReadonlyMap<number, number>;
	steps: ReadonlyMap<number, number>;
	columns: number;
	rows: number;
}>;

/** Column breaks from 0 to 1: the snapped rear corners first (by rear chain index), so their rear
 * sides lie on one parcel edge, then the even breaks of the column count that keep the minimum
 * width from them. */
// Exact arithmetic: structural counts and unit parameters, not tunables.
function columnBreaks(
	f: Frame,
	id: string,
	columns: number,
	rows: number,
	snap: ReadonlySet<number>
): Grid {
	const reach = Math.max(
		span(f.points[f.front.corners[0]], f.points[f.front.corners[1]]),
		chainLength(f, f.rear)
	);
	const gap = (s: number, t: number) => reach * Math.abs(s - t);
	const breaks = /* Exact arithmetic: whole strip interval. */ [0, 1];
	const snapped = new Map<number, number>();
	const steps = new Map<number, number>();
	f.rear.params.slice(1, -1).forEach((t, i) => {
		if (snap.has(i + 1) && breaks.every((s) => gap(s, t) >= stripMinimumWidthM)) {
			breaks.push(t);
			snapped.set(t, f.rear.corners[i + 1]);
		}
	});
	for (let k = 1; k < columns; k += 1) {
		const t = k / columns;
		if ([...snapped.keys()].every((s) => gap(s, t) >= stripMinimumWidthM)) {
			breaks.push(t);
			steps.set(t, k);
		}
	}
	return { id, breaks: [...new Set(breaks)].sort((s, t) => s - t), snapped, steps, columns, rows };
}

type GridPoint = Readonly<{ key: string; at: Vec2; jointKey?: string }>;
type Point = GridPoint & Readonly<{ edge: string | null }>;

/** A point on a strip side that spans one seam uses its fraction along the canonical seam.
 * Fractions such as 1/3 and 2/6 then join even when the two strip grids have different counts. */
function seamJointKey(f: Frame, c: Chain, step: number, count: number) {
	const [a, b] = c.corners;
	if (c.corners.length !== 2 || !f.seams?.has(f.edge(c.forward ? a : b))) return;
	const [from, to] = [f.keys[a], f.keys[b]];
	return encodeKey(['seam-point', encodePair(from, to), (from < to ? step : count - step) / count]);
}

function gridJointKey(f: Frame, grid: Grid, i: number, j: number) {
	if (!f.seams?.size) return;
	if (i === 0) return seamJointKey(f, f.left, j, grid.rows);
	if (i === grid.breaks.length - 1) return seamJointKey(f, f.right, j, grid.rows);
	const step = grid.steps.get(grid.breaks[i]);
	if (step === undefined) return;
	if (j === 0) return seamJointKey(f, f.front, step, grid.columns);
	if (j === grid.rows) return seamJointKey(f, f.rear, step, grid.columns);
}

/** Grid points use the original corner key where they meet one and a strip tuple elsewhere. */
// Exact arithmetic: structural counts and unit parameters, not tunables.
function gridKey(f: Frame, grid: Grid, i: number, j: number): GridPoint {
	const last = grid.breaks.length - 1;
	const corner = (k: number) => ({ key: f.keys[k], at: f.points[k] });
	const end = (c: Chain) => c.corners[c.corners.length - 1];
	if (j === 0 && i === 0) return corner(f.front.corners[0]);
	if (j === 0 && i === last) return corner(f.front.corners[1]);
	if (j === grid.rows && i === 0) return corner(f.rear.corners[0]);
	if (j === grid.rows && i === last) return corner(end(f.rear));
	if (j === grid.rows && f.rear.corners.length === 1) return corner(f.rear.corners[0]);
	const snapped = j === grid.rows ? grid.snapped.get(grid.breaks[i]) : undefined;
	if (snapped !== undefined) return corner(snapped);
	return {
		key: encodeKey(['grid', grid.id, i, j]),
		jointKey: gridJointKey(f, grid, i, j),
		at: patchPoint(f, grid.breaks[i], j / grid.rows)
	};
}

/** Points along one cell side from parameter t0 to t1 of a chain: the start point and every
 * chain corner strictly between, each carrying the parcel edge of the side that starts at it,
 * or null for an inner side. */
function run(f: Frame, c: Chain, from: GridPoint, t0: number, t1: number, outer: boolean): Point[] {
	const inner = outer
		? c.params
				.map((t, k) => ({ t, k: c.corners[k] }))
				.filter(({ t }) => (t0 < t1 ? t > t0 && t < t1 : t < t0 && t > t1))
				.sort((a, b) => (t0 < t1 ? a.t - b.t : b.t - a.t))
		: [];
	const stops = [t0, ...inner.map(({ t }) => t), t1];
	const points: GridPoint[] = [
		from,
		...inner.map(({ k }) => ({ key: f.keys[k], at: f.points[k] }))
	];
	return points.map((point, s) => ({
		...point,
		edge: outer
			? chainEdge(f, c, Math.min(stops[s], stops[s + 1]), Math.max(stops[s], stops[s + 1]))
			: null
	}));
}

// Exact arithmetic: a zero-length side starts at a repeated key.
function dedupe(ring: readonly Point[]): Point[] {
	return ring.filter((point, i) => point.key !== ring[(i + 1) % ring.length].key);
}

/** One strip cell as a keyed ring: front, right, rear and left sides with the parcel corners that
 * lie on them. */
function cellRing(f: Frame, grid: Grid, id: string, i: number, j: number): KeyedRing {
	const p = (ii: number, jj: number) => gridKey(f, grid, ii, jj);
	const [u0, u1] = [grid.breaks[i], grid.breaks[i + 1]];
	const [v0, v1] = [j / grid.rows, (j + 1) / grid.rows];
	const ring = dedupe([
		...run(f, f.front, p(i, j), u0, u1, j === 0),
		...run(
			f,
			f.right,
			p(i + 1, j),
			v0,
			v1,
			i + /* Exact arithmetic: right boundary follows the final interval. */ 2 ===
				grid.breaks.length
		),
		...run(f, f.rear, p(i + 1, j + 1), u1, u0, j + 1 === grid.rows),
		...run(f, f.left, p(i, j + 1), v1, v0, i === 0)
	]);
	return {
		id: `${id}/strip/${encodeKey([i, j])}`,
		corner: `${id}/strip/${encodeKey([i])}`,
		ear: null,
		keys: ring.map(({ key }) => key),
		jointKeys: ring.map(({ key, jointKey }) => jointKey ?? key),
		points: ring.map(({ at }) => at),
		edges: ring.map(({ edge }) => edge)
	};
}

/** Width of a cell: twice its area over its perimeter, the inradius-like measure of a sliver. */
export function cellWidth(points: readonly Vec2[]): number {
	const perimeter = points.reduce((sum, p, i) => sum + span(p, points[(i + 1) % points.length]), 0);
	return perimeter > 0 ? doubleArea(points) / perimeter : 0;
}

// Exact arithmetic: relative area agreement, a scale-free check.
function accepted(cells: readonly KeyedRing[], parcelArea: number): boolean {
	const ok = cells.every(
		({ points }) =>
			points.length >= 3 &&
			cellWidth(points) >= stripMinimumWidthM &&
			isConvexCounterclockwise(points)
	);
	const total = cells.reduce((sum, { points }) => sum + doubleArea(points) / 2, 0);
	return (
		ok &&
		Math.abs(total - parcelArea) <= stripAreaToleranceRatio * parcelArea + stripAreaToleranceM2
	);
}

/** Columns from the frontage length and rows from the mean side depth, each a whole number of
 * target edges, kept between the minimum and maximum cell count. Throws RangeError for
 * nonpositive or nonfinite lengths in meters. */
// Exact arithmetic: whole counts.
export function stripCounts(front: number, depth: number): StripCounts {
	if (![front, depth].every((length) => length > 0 && Number.isFinite(length)))
		throw new RangeError('Strip frontage and depth must be finite positive lengths');
	let edge: number = stripTargetEdgeM;
	const count = (length: number) => Math.max(1, Math.round(length / edge));
	let [columns, rows] = [count(front), count(depth)];
	if (columns * rows > stripMaximumCells) {
		const area = front * depth;
		edge = Number.isFinite(area)
			? Math.sqrt(area / stripMaximumCells)
			: Math.sqrt(front / stripMaximumCells) * Math.sqrt(depth);
		columns = Math.min(stripMaximumCells, count(front));
		rows = Math.min(stripMaximumCells, count(depth));
		while (columns * rows > stripMaximumCells) {
			if (columns >= rows) columns -= /* Exact arithmetic: remove one column. */ 1;
			else rows -= /* Exact arithmetic: remove one row. */ 1;
		}
	}
	while (columns * rows < stripMinimumCells && rows < stripMinimumCells)
		rows += /* Exact arithmetic: add one row. */ 1;
	return { columns, rows };
}

/** Snap all rear corners first, then try dropping one corner at a time, then use even columns.
 * The number of single-corner retries is bounded even on long rear chains. */
function* snapChoices(f: Frame): Iterable<ReadonlySet<number>> {
	const inner = f.rear.corners.slice(1, -1).map((_, i) => i + 1);
	if (inner.length) yield new Set(inner);
	if (inner.length > 1 && stripSnapRetries > 0)
		for (const dropped of inner.slice(-stripSnapRetries).reverse())
			yield new Set(inner.filter((corner) => corner !== dropped));
	yield new Set();
}

/** Strip cells of a parcel as keyed rings, or undefined when no count down to one cell keeps
 * every cell convex, at least the minimum width and the parcel's area. Unsnapped corners remain
 * in their rear cells. */
export function stripRings(
	parcel: Parcel,
	id: string,
	edge: (from: number) => string,
	seams?: ReadonlySet<string>
) {
	const f = frame(parcel, edge, seams);
	if (!f) return undefined;
	const parcelArea = doubleArea(f.points) / 2;
	const front = span(f.points[f.front.corners[0]], f.points[f.front.corners[1]]);
	const depth = (chainLength(f, f.left) + chainLength(f, f.right)) / 2;
	let { columns, rows } = stripCounts(front, depth);
	for (;;) {
		for (const snap of snapChoices(f)) {
			const grid = columnBreaks(f, id, columns, rows, snap);
			const cells = Array.from({ length: rows }, (_, j) =>
				Array.from({ length: grid.breaks.length - 1 }, (_, i) => cellRing(f, grid, id, i, j))
			).flat();
			if (accepted(cells, parcelArea)) return cells;
		}
		if (columns > 1 && (columns >= rows || rows === 1))
			columns -= /* Exact arithmetic: remove one column. */ 1;
		else if (rows > 1) rows -= /* Exact arithmetic: remove one row. */ 1;
		else return undefined;
	}
}
