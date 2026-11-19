/**
 * Ear-clipping triangulation of one simple ring without holes. Port of mapbox/earcut 3.0.2 as
 * vendored by three.js (`ShapeUtils.triangulateShape(contour, [])`), reduced to the hole-free path.
 * The z-order hash is omitted: for rings without holes it only skips points outside the ear's
 * bounding box, so it never changes which ear is cut and the triangle order stays identical.
 *
 * mapbox/earcut: ISC License, Copyright (c) 2024, Mapbox. Permission to use, copy, modify, and/or
 * distribute this software for any purpose with or without fee is hereby granted, provided that
 * the above copyright notice and this permission notice appear in all copies.
 */
import type { Point2 } from '../vocab';

type Node = { i: number; x: number; y: number; prev: Node; next: Node };

/**
 * Triangulates a simple polygon ring (any winding, coordinates in meters).
 * A closing point equal to the first point is ignored. Returns index triples into `ring` in
 * earcut cut order; degenerate rings yield `[]`. Does not mutate `ring`.
 */
export function triangulate(ring: readonly Point2[]): [number, number, number][] {
	const n = closesOnFirst(ring) ? ring.length - 1 : ring.length;
	const flat: number[] = [];
	const start = linkedList(ring, n);
	if (start && start.next !== start.prev) earcutLinked(start, flat, 0);
	const faces: [number, number, number][] = [];
	for (let i = 0; i < flat.length; i += 3) faces.push([flat[i], flat[i + 1], flat[i + 2]]);
	return faces;
}

function closesOnFirst(ring: readonly Point2[]): boolean {
	const l = ring.length;
	return l > 2 && ring[l - 1][0] === ring[0][0] && ring[l - 1][1] === ring[0][1];
}

/** Circular doubly linked list in clockwise order (earcut's outer-ring orientation). */
function linkedList(ring: readonly Point2[], n: number): Node | undefined {
	let last: Node | undefined;
	if (signedArea(ring, n) > 0) for (let i = 0; i < n; i++) last = insertNode(i, ring[i], last);
	else for (let i = n - 1; i >= 0; i--) last = insertNode(i, ring[i], last);
	if (last && equals(last, last.next)) {
		removeNode(last);
		last = last.next;
	}
	return last;
}

function signedArea(ring: readonly Point2[], n: number): number {
	let sum = 0;
	for (let i = 0, j = n - 1; i < n; j = i++)
		sum += (ring[j][0] - ring[i][0]) * (ring[i][1] + ring[j][1]);
	return sum;
}

/** Removes collinear and duplicate points between `start` and `end`. */
function filterPoints(start: Node, end: Node = start): Node {
	let p = start;
	let again: boolean;
	do {
		again = false;
		if (equals(p, p.next) || area(p.prev, p, p.next) === 0) {
			removeNode(p);
			p = end = p.prev;
			if (p === p.next) break;
			again = true;
		} else {
			p = p.next;
		}
	} while (again || p !== end);
	return end;
}

/** Main ear-slicing loop; passes 1 and 2 are earcut's fallbacks for degenerate rings. */
function earcutLinked(start: Node, triangles: number[], pass: 0 | 1 | 2): void {
	let ear = start;
	let stop = ear;
	while (ear.prev !== ear.next) {
		const prev = ear.prev;
		const next = ear.next;
		if (isEar(ear)) {
			triangles.push(prev.i, ear.i, next.i);
			removeNode(ear);
			ear = stop = next.next;
			continue;
		}
		ear = next;
		if (ear !== stop) continue;
		if (pass === 0) earcutLinked(filterPoints(ear), triangles, 1);
		else if (pass === 1)
			earcutLinked(cureLocalIntersections(filterPoints(ear), triangles), triangles, 2);
		else splitEarcut(ear, triangles);
		break;
	}
}

function isEar(ear: Node): boolean {
	const a = ear.prev;
	const c = ear.next;
	if (area(a, ear, c) >= 0) return false;
	const x0 = Math.min(a.x, ear.x, c.x);
	const y0 = Math.min(a.y, ear.y, c.y);
	const x1 = Math.max(a.x, ear.x, c.x);
	const y1 = Math.max(a.y, ear.y, c.y);
	for (let p = c.next; p !== a; p = p.next) {
		if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
		if (pointInTriangleExceptFirst(a, ear, c, p) && area(p.prev, p, p.next) >= 0) return false;
	}
	return true;
}

function cureLocalIntersections(first: Node, triangles: number[]): Node {
	let start = first;
	let p = start;
	do {
		const a = p.prev;
		const b = p.next.next;
		if (
			!equals(a, b) &&
			intersects(a, p, p.next, b) &&
			locallyInside(a, b) &&
			locallyInside(b, a)
		) {
			triangles.push(a.i, p.i, b.i);
			removeNode(p);
			removeNode(p.next);
			p = start = b;
		}
		p = p.next;
	} while (p !== start);
	return filterPoints(p);
}

function splitEarcut(start: Node, triangles: number[]): void {
	let a = start;
	do {
		for (let b = a.next.next; b !== a.prev; b = b.next) {
			if (a.i === b.i || !isValidDiagonal(a, b)) continue;
			let c = splitPolygon(a, b);
			a = filterPoints(a, a.next);
			c = filterPoints(c, c.next);
			earcutLinked(a, triangles, 0);
			earcutLinked(c, triangles, 0);
			return;
		}
		a = a.next;
	} while (a !== start);
}

function pointInTriangleExceptFirst(a: Node, b: Node, c: Node, p: Node): boolean {
	if (a.x === p.x && a.y === p.y) return false;
	return (
		(c.x - p.x) * (a.y - p.y) >= (a.x - p.x) * (c.y - p.y) &&
		(a.x - p.x) * (b.y - p.y) >= (b.x - p.x) * (a.y - p.y) &&
		(b.x - p.x) * (c.y - p.y) >= (c.x - p.x) * (b.y - p.y)
	);
}

function isValidDiagonal(a: Node, b: Node): boolean {
	if (a.next.i === b.i || a.prev.i === b.i || intersectsPolygon(a, b)) return false;
	return isVisibleDiagonal(a, b) || isZeroLengthDiagonal(a, b);
}

/** Locally visible and without opposite-facing sectors. */
function isVisibleDiagonal(a: Node, b: Node): boolean {
	if (!locallyInside(a, b) || !locallyInside(b, a) || !middleInside(a, b)) return false;
	return !!(area(a.prev, a, b.prev) || area(a, b.prev, b));
}

function isZeroLengthDiagonal(a: Node, b: Node): boolean {
	return equals(a, b) && area(a.prev, a, a.next) > 0 && area(b.prev, b, b.next) > 0;
}

function area(p: Node, q: Node, r: Node): number {
	return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}

function equals(p: Node, q: Node): boolean {
	return p.x === q.x && p.y === q.y;
}

function intersects(p1: Node, q1: Node, p2: Node, q2: Node): boolean {
	const o1 = sign(area(p1, q1, p2));
	const o2 = sign(area(p1, q1, q2));
	const o3 = sign(area(p2, q2, p1));
	const o4 = sign(area(p2, q2, q1));
	if (o1 !== o2 && o3 !== o4) return true;
	return (
		touches(o1, p1, p2, q1) ||
		touches(o2, p1, q2, q1) ||
		touches(o3, p2, p1, q2) ||
		touches(o4, p2, q1, q2)
	);
}

/** Collinear case: orientation `o` is 0 and q lies on segment p-r. */
function touches(o: number, p: Node, q: Node, r: Node): boolean {
	return o === 0 && onSegment(p, q, r);
}

/** Sign that maps NaN to 0, as earcut does. */
function sign(value: number): number {
	return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/** For collinear p, q, r: whether q lies within the bounding box of segment p-r. */
function onSegment(p: Node, q: Node, r: Node): boolean {
	const x = q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x);
	return x && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}

function intersectsPolygon(a: Node, b: Node): boolean {
	let p = a;
	do {
		const touches = p.i === a.i || p.next.i === a.i || p.i === b.i || p.next.i === b.i;
		if (!touches && intersects(p, p.next, a, b)) return true;
		p = p.next;
	} while (p !== a);
	return false;
}

function locallyInside(a: Node, b: Node): boolean {
	return area(a.prev, a, a.next) < 0
		? area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0
		: area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
}

function middleInside(a: Node, b: Node): boolean {
	let p = a;
	let inside = false;
	const px = (a.x + b.x) / 2;
	const py = (a.y + b.y) / 2;
	do {
		const n = p.next;
		if (p.y > py !== n.y > py && n.y !== p.y && px < ((n.x - p.x) * (py - p.y)) / (n.y - p.y) + p.x)
			inside = !inside;
		p = n;
	} while (p !== a);
	return inside;
}

/** Splits the ring along diagonal a-b; returns the copy of b that starts the second ring. */
function splitPolygon(a: Node, b: Node): Node {
	const a2 = createNode(a.i, a.x, a.y);
	const b2 = createNode(b.i, b.x, b.y);
	const an = a.next;
	const bp = b.prev;
	a.next = b;
	b.prev = a;
	a2.next = an;
	an.prev = a2;
	b2.next = a2;
	a2.prev = b2;
	bp.next = b2;
	b2.prev = bp;
	return b2;
}

function insertNode(i: number, point: Point2, last: Node | undefined): Node {
	const p = createNode(i, point[0], point[1]);
	if (!last) return p;
	p.next = last.next;
	p.prev = last;
	last.next.prev = p;
	last.next = p;
	return p;
}

function removeNode(p: Node): void {
	p.next.prev = p.prev;
	p.prev.next = p.next;
}

/** A single-node ring; callers link it. */
function createNode(i: number, x: number, y: number): Node {
	const p = { i, x, y } as Node;
	p.prev = p.next = p;
	return p;
}
