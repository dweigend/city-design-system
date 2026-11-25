import { materialSettings } from '../../../config/material';
import type { Vec2 } from '../../core/geometry';
import { clipHalfPlane, clipToOutline, cutOpenings, segmentOutside, type Rect } from './cells';
import type { PatternParams } from './families';
import { fitPitch, type FaceMap, type PatternFrame } from './pattern';

const { planeToleranceM, dotSides } = materialSettings;

/** A face to print on: its outline and openings in patch meters, its map into the body box and
 * the body box itself. */
export type PrintFace = Readonly<{
	outline: readonly Vec2[];
	openings: readonly Rect[];
	map: FaceMap;
	body: PatternFrame;
}>;

const coordinate = (map: FaceMap, k: number) => (point: Vec2) =>
	map.at[k] + map.perU[k] * point[0] + map.perV[k] * point[1];

const slope = (map: FaceMap, k: number) => Math.hypot(map.perU[k], map.perV[k]);

function range(outline: readonly Vec2[], value: (point: Vec2) => number) {
	const values = outline.map(value);
	return [Math.min(...values), Math.max(...values)] as const;
}

/** Stripes across the body's long axis: every period prints its first `share` dark. A face that
 * does not run along the long axis (an end face) stays plain. Bands are cut around openings. */
// Exact arithmetic: axis 0 is the body's long axis.
export function stripeMarks(face: PrintFace, params: PatternParams): Vec2[][] {
	if (slope(face.map, /* Exact arithmetic: first pattern axis. */ 0) <= planeToleranceM) return [];
	const pitch = fitPitch(face.body.size[0], params.pitch);
	const along = coordinate(face.map, /* Exact arithmetic: first pattern axis. */ 0);
	const [low, high] = range(face.outline, along);
	const marks: Vec2[][] = [];
	for (let k = Math.floor(low / pitch); k * pitch < high; k++) {
		const [from, to] = [k * pitch, (k + params.share) * pitch];
		const band = clipHalfPlane(
			clipHalfPlane([...face.outline], (point) => along(point) - from),
			(point) => to - along(point)
		);
		if (band.length) marks.push(...cutOpenings(band, face.openings));
	}
	return marks;
}

/** The two body axes that lie most in the face, steepest first. */
// Exact arithmetic: the indices of the three body axes.
function faceAxes(map: FaceMap): [number, number] {
	const [first, second] = /* Exact arithmetic: pattern coordinate indices. */ [0, 1, 2].sort(
		(a, b) => slope(map, b) - slope(map, a)
	);
	return [first, second];
}

// Exact arithmetic: a regular polygon of `dotSides` corners, counter-clockwise.
function dot([u, v]: Vec2, radius: number): Vec2[] {
	return Array.from({ length: dotSides }, (_, i) => {
		const angle = (2 * Math.PI * i) / dotSides;
		return [u + radius * Math.cos(angle), v + radius * Math.sin(angle)] as Vec2;
	});
}

function clear([u, v]: Vec2, radius: number, openings: readonly Rect[]) {
	return openings.every(
		([u0, v0, u1, v1]) =>
			u + radius <= u0 || u - radius >= u1 || v + radius <= v0 || v - radius >= v1
	);
}

function whole(polygon: readonly Vec2[], outline: readonly Vec2[]) {
	return clipToOutline(polygon, outline).length === polygon.length;
}

/** A dot grid over the two body axes that lie in the face, each axis fitted to whole periods over
 * the body, so the first row sits half a period from every body edge on every face. Dots that
 * would cross the face outline or an opening are left out. */
// Exact arithmetic: dots sit at the middle of each fitted period.
export function dotMarks(face: PrintFace, params: PatternParams): Vec2[][] {
	const [p, q] = faceAxes(face.map);
	const { map, body } = face;
	const det = map.perU[p] * map.perV[q] - map.perV[p] * map.perU[q];
	if (Math.abs(det) <= planeToleranceM) return [];
	const pitch = [fitPitch(body.size[p], params.pitch), fitPitch(body.size[q], params.pitch)];
	const radius = (params.share * params.pitch) / 2;
	const [lowP, highP] = range(face.outline, coordinate(map, p));
	const [lowQ, highQ] = range(face.outline, coordinate(map, q));
	const marks: Vec2[][] = [];
	for (let i = Math.floor(lowP / pitch[0]); (i + 0.5) * pitch[0] < highP; i++)
		for (let j = Math.floor(lowQ / pitch[1]); (j + 0.5) * pitch[1] < highQ; j++) {
			const [a, b] = [(i + 0.5) * pitch[0] - map.at[p], (j + 0.5) * pitch[1] - map.at[q]];
			const centre: Vec2 = [
				(a * map.perV[q] - b * map.perV[p]) / det,
				(b * map.perU[p] - a * map.perU[q]) / det
			];
			const mark = dot(centre, radius);
			if (clear(centre, radius, face.openings) && whole(mark, face.outline)) marks.push(mark);
		}
	return marks;
}

/** The segment of the line `value(point) = level` inside a convex outline, if any. */
function chord(map: FaceMap, k: number, level: number, outline: readonly Vec2[]) {
	const [du, dv] = [map.perU[k], map.perV[k]];
	const norm = du * du + dv * dv;
	const base: Vec2 = [((level - map.at[k]) * du) / norm, ((level - map.at[k]) * dv) / norm];
	const reach = outline.reduce((most, [u, v]) => Math.max(most, Math.hypot(u, v)), 0) * 2 + 1;
	const direction: Vec2 = [-dv / Math.sqrt(norm), du / Math.sqrt(norm)];
	let [enter, exit] = [-reach, reach];
	for (const [i, a] of outline.entries()) {
		const b = outline[(i + 1) % outline.length];
		const side = (point: Vec2) =>
			(b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
		const start = side(base);
		const rate = side([base[0] + direction[0], base[1] + direction[1]]) - start;
		if (Math.abs(rate) <= planeToleranceM) {
			if (start < 0) return undefined;
			continue;
		}
		const t = -start / rate;
		if (rate > 0) enter = Math.max(enter, t);
		else exit = Math.min(exit, t);
	}
	if (exit - enter <= planeToleranceM) return undefined;
	const at = (t: number): Vec2 => [base[0] + direction[0] * t, base[1] + direction[1] * t];
	return [at(enter), at(exit)] as const;
}

/** Hairline panel joints (MAT-12) at the joint module along the body and up, fitted to whole
 * panels over the body and left out on the body's own edges, as patch-meter segments outside the
 * openings. */
// Exact arithmetic: axes 0 and 2 are the body's long axis and up.
export function jointSegments(face: PrintFace, params: PatternParams): [Vec2, Vec2][] {
	const segments: [Vec2, Vec2][] = [];
	for (const [k, module] of /* Exact arithmetic: joint axis indices. */ [
		[0, params.joint[0]],
		[2, params.joint[1]]
	] as const) {
		if (!(module > 0) || slope(face.map, k) <= planeToleranceM) continue;
		const pitch = fitPitch(face.body.size[k], module);
		const [low, high] = range(face.outline, coordinate(face.map, k));
		for (
			let i = Math.ceil(low / pitch + planeToleranceM);
			i * pitch < high - planeToleranceM;
			i++
		) {
			if (i <= 0 || i * pitch >= face.body.size[k] - planeToleranceM) continue;
			const line = chord(face.map, k, i * pitch, face.outline);
			if (line) segments.push(...segmentOutside(line[0], line[1], face.openings));
		}
	}
	return segments;
}

/** Estimated marks of a pattern on a face, for the triangle budget before building. */
export function estimateMarks(area: number, params: PatternParams, dots: boolean): number {
	return dots ? area / params.pitch ** 2 : Math.sqrt(area) / params.pitch + 1;
}
