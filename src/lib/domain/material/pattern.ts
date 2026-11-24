import { materialSettings } from '../../../config/material';
import { dotProduct, scaled, sum, type Vec3 } from '../../core/geometry';
import { readFrame, type Frame, type Patch, type PatternFrame } from './patch';

const { planeToleranceM } = materialSettings;

export type { PatternFrame };

/** Body coordinate k at patch point (u, v) is `at[k] + perU[k]·u + perV[k]·v`. */
export type FaceMap = Readonly<{ at: Vec3; perU: Vec3; perV: Vec3 }>;

// Exact arithmetic: world up.
const up: Vec3 = [0, 0, 1];

// Exact arithmetic: outline corners lie on the face plane.
function corners(frame: Frame): Vec3[] {
	return frame.outline.map(([u, v]) => frame.point(u, v, 0));
}

// Exact arithmetic: a horizontal direction with zero rise; the default axis is world X.
function longAxis(points: readonly Vec3[][]): Vec3 {
	let best: Vec3 = [1, 0, 0];
	let longest = 0;
	for (const ring of points)
		for (const [i, a] of ring.entries()) {
			const b = ring[(i + 1) % ring.length];
			const [dx, dy, dz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
			const run = Math.hypot(dx, dy);
			if (Math.abs(dz) > planeToleranceM || run <= longest) continue;
			longest = run;
			best =
				dx < -planeToleranceM || (Math.abs(dx) <= planeToleranceM && dy < 0)
					? [-dx / run, -dy / run, 0]
					: [dx / run, dy / run, 0];
		}
	return best;
}

/** The body box of one or more patches of the same body: up is world Z, the long axis follows
 * the longest level edge of their outlines (world X when none is level). Throws RangeError for an
 * invalid patch or an empty list. */
// Exact arithmetic: axis indices and the world origin.
export function createPatternFrame(patches: readonly Patch[]): PatternFrame {
	if (!patches.length) throw new RangeError('A pattern frame needs at least one patch');
	const rings = patches.map((patch) => corners(readFrame(patch)));
	const along = longAxis(rings);
	const across: Vec3 = [-along[1], along[0], 0];
	const axes = [along, across, up] as const;
	const points = rings.flat();
	const low = axes.map((axis) => Math.min(...points.map((p) => dotProduct(p, axis))));
	const high = axes.map((axis) => Math.max(...points.map((p) => dotProduct(p, axis))));
	const origin = axes.reduce<Vec3>((total, axis, k) => sum(total, scaled(axis, low[k])), [0, 0, 0]);
	return { origin, axes, size: [high[0] - low[0], high[1] - low[1], high[2] - low[2]] };
}

/** The affine map from patch meters to body coordinates. */
// Exact arithmetic: the patch origin and a negation.
export function readFaceMap(frame: Frame, body: PatternFrame): FaceMap {
	const start = sum(frame.point(0, 0, 0), scaled(body.origin, -1));
	const project = (vector: Vec3) =>
		body.axes.map((axis) => dotProduct(vector, axis)) as unknown as Vec3;
	return { at: project(start), perU: project(frame.patch.across), perV: project(frame.up) };
}

/** A pattern period fitted to whole periods over a body extent, so both ends of the body are
 * period boundaries. An extent below one period keeps the period. */
export function fitPitch(extent: number, pitch: number): number {
	const count = Math.round(extent / pitch);
	return count >= 1 ? extent / count : pitch;
}
