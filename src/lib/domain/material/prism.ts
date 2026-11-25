import { materialSettings } from '../../../config/material';
import type { Vec2, Vec3 } from '../../core/geometry';
import type { Frame } from './patch';

const { planeToleranceM } = materialSettings;

/** A face height above the patch plane, linear in u and v: w = at + perU·u + perV·v. */
export type Plane = Readonly<{ at: number; perU?: number; perV?: number }>;

/** Growing triangle soup for one slot, in world meters, with each face's vertices unshared.
 * Side faces are keyed in patch coordinates so a hidden pair can be dropped. */
export type MeshSink = {
	positions: number[];
	faces: number[][];
	sides: Map<string, number>;
};

export function createSink(): MeshSink {
	return { positions: [], faces: [], sides: new Map() };
}

// Exact arithmetic: a missing slope is level.
function height(
	{
		at,
		perU = /* Exact arithmetic: ungraded plane along U. */ 0,
		perV = /* Exact arithmetic: ungraded plane along V. */ 0
	}: Plane,
	[u, v]: Vec2
) {
	return at + perU * u + perV * v;
}

function sideEndpoint([u, v]: Vec2, base: number, top: number) {
	return [u, v, base, top].map((x) => Math.round(x / planeToleranceM)).join(',');
}

function addPolygon(sink: MeshSink, points: readonly Vec3[]) {
	const start = sink.positions.length / 3;
	for (const point of points) sink.positions.push(...point);
	const indices: number[] = [];
	for (let i = 1; i + 1 < points.length; i++) indices.push(start, start + i, start + i + 1);
	sink.faces.push(indices);
}

/** Adds a side face, or drops it with an identical face from a neighbouring cell: the pair
 * would be hidden inside the solid and draw a false crease line. */
function addSide(sink: MeshSink, points: readonly Vec3[], start: string, end: string) {
	const opposite = end + '/' + start;
	const twin = sink.sides.get(opposite);
	if (twin !== undefined && start !== end) {
		sink.faces[twin] = [];
		sink.sides.delete(opposite);
		return;
	}
	sink.sides.set(start + '/' + end, sink.faces.length);
	addPolygon(sink, points);
}

/** Adds a raised convex cell: top face, optional bottom face and every side whose height is not
 * degenerate. Faces wind outward, so shading reads the patch's real orientation. */
export function addCell(
	sink: MeshSink,
	frame: Frame,
	polygon: readonly Vec2[],
	base: number,
	top: Plane,
	closed: boolean
) {
	const tops = polygon.map((point) => Math.max(base, height(top, point)));
	addPolygon(
		sink,
		polygon.map(([u, v], i) => frame.point(u, v, tops[i]))
	);
	if (closed)
		addPolygon(
			sink,
			[...polygon].reverse().map(([u, v]) => frame.point(u, v, base))
		);
	for (const [i, [u0, v0]] of polygon.entries()) {
		const next = (i + 1) % polygon.length;
		const [u1, v1] = polygon[next];
		const rise = [tops[i] - base, tops[next] - base];
		if (rise[0] <= planeToleranceM && rise[1] <= planeToleranceM) continue;
		const side = [frame.point(u0, v0, base), frame.point(u1, v1, base)];
		if (rise[1] > planeToleranceM) side.push(frame.point(u1, v1, tops[next]));
		if (rise[0] > planeToleranceM) side.push(frame.point(u0, v0, tops[i]));
		addSide(
			sink,
			side,
			sideEndpoint(polygon[i], base, tops[i]),
			sideEndpoint(polygon[next], base, tops[next])
		);
	}
}

/** Flattened triangle indices of a sink. */
export function readIndices(sink: MeshSink) {
	return sink.faces.flat();
}
