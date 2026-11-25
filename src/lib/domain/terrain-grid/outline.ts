import { defaults } from '../../../config/terrain-grid';
import { measurePolygon, type Vec2 } from '../../core/geometry';

const epsilon = defaults.outlineToleranceM;

export function cross([ax, ay]: Vec2, [bx, by]: Vec2, [x, y]: Vec2) {
	return (bx - ax) * (y - ay) - (by - ay) * (x - ax);
}

function onEdge(a: Vec2, b: Vec2, point: Vec2) {
	const [x, y] = point;
	return (
		Math.abs(cross(a, b, point)) <= epsilon &&
		x >= Math.min(a[0], b[0]) - epsilon &&
		x <= Math.max(a[0], b[0]) + epsilon &&
		y >= Math.min(a[1], b[1]) - epsilon &&
		y <= Math.max(a[1], b[1]) + epsilon
	);
}

function signedCross(a: Vec2, b: Vec2, c: Vec2) {
	const value = cross(a, b, c);
	return Math.abs(value) <= epsilon ? 0 : Math.sign(value);
}

type Edge = readonly [Vec2, Vec2];

function intersects([a, b]: Edge, [c, d]: Edge) {
	return (
		onEdge(a, b, c) ||
		onEdge(a, b, d) ||
		onEdge(c, d, a) ||
		onEdge(c, d, b) ||
		(signedCross(a, b, c) * signedCross(a, b, d) < 0 &&
			signedCross(c, d, a) * signedCross(c, d, b) < 0)
	);
}

function edges(ring: readonly Vec2[]): Edge[] {
	return ring.map((from, i) => [from, ring[(i + 1) % ring.length]]);
}

export function validateOutline(ring: readonly Vec2[]) {
	if (
		ring.length < 3 ||
		!Array.from(ring).every(
			(point) =>
				Array.isArray(point) &&
				point.length === 2 &&
				Number.isFinite(point[0]) &&
				Number.isFinite(point[1])
		)
	)
		throw new RangeError('Expected at least three finite points for the outline');
	const segments = edges(ring);
	const { area } = measurePolygon(ring);
	// The outline tolerance originally compared the doubled signed area.
	if (Math.abs(area) <= epsilon / 2) throw new RangeError('Expected a nonzero outline area');
	for (const [i, [a, b]] of segments.entries()) {
		const next = ring[(i + 2) % ring.length];
		if (onEdge(a, b, next) || onEdge(b, next, a))
			throw new RangeError('Outline sides must not double back');
		for (
			let j = i + /* Exact arithmetic: skip the adjacent segment. */ 2;
			j < segments.length;
			j++
		) {
			if (i === 0 && j === segments.length - 1) continue;
			if (intersects(segments[i], segments[j])) throw new RangeError('Outline must be simple');
		}
	}
}

function contains(segments: readonly Edge[], point: Vec2) {
	const [x, y] = point;
	let inside = false;
	for (const [a, b] of segments) {
		if (onEdge(a, b, point)) return true;
		if (a[1] > y === b[1] > y) continue;
		if (x < a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])) inside = !inside;
	}
	return inside;
}

// The site boundary may touch a cell, but may not enter its strictly convex interior.
function enters([a, b]: Edge, cell: readonly Edge[]) {
	let start = 0;
	let end = 1;
	for (const [from, to] of cell) {
		const u = cross(from, to, a) - epsilon;
		const v = cross(from, to, b) - epsilon;
		if (u <= 0 && v <= 0) return false;
		if (u <= 0) start = Math.max(start, u / (u - v));
		if (v <= 0) end = Math.min(end, u / (u - v));
	}
	return end > start;
}

export function insideOutline(outline: readonly Vec2[]) {
	const segments = edges(outline);
	return (cell: readonly Vec2[]) => {
		if (!cell.every((point) => contains(segments, point))) return false;
		const sides = edges(cell);
		return !segments.some((segment) => enters(segment, sides));
	};
}
