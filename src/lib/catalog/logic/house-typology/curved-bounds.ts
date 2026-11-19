import type { Bounds } from '../ansicht/geometrie';
import type { FitPart } from './types';

function encloseRing(p: Extract<FitPart, { kind: 'ring' }>, box: Bounds) {
	const tilt = p.tilt ?? 0,
		yaw = p.rotation ?? 0;
	const axis = [Math.cos(tilt) * Math.cos(yaw), Math.cos(tilt) * Math.sin(yaw), Math.sin(tilt)];
	const sag =
		p.curvature && p.curvature > p.radius
			? p.curvature - Math.sqrt(p.curvature ** 2 - p.radius ** 2)
			: 0;
	for (const [i, v] of axis.entries()) {
		const radius = p.radius * Math.sqrt(Math.max(0, 1 - v * v)) + (Math.abs(v) * p.depth) / 2;
		box.min[i] = p.position[i] - radius - Math.max(0, sag * v);
		box.max[i] = p.position[i] + radius - Math.min(0, sag * v);
	}
}
function encloseFrame(
	p: Extract<FitPart, { kind: 'frame' }>,
	box: Bounds,
	members: NonNullable<typeof p.members>
) {
	for (const point of members.flat())
		for (let i = 0; i < 3; i++) {
			box.min[i] = Math.min(box.min[i], point[i] - p.bar);
			box.max[i] = Math.max(box.max[i], point[i] + p.bar);
		}
}
function encloseSpline(box: Bounds) {
	// A Catmull-Rom segment can overshoot its control polygon. Treat an unresolved spline as a possible contact.
	const diameter = Math.hypot(...box.max.map((v, i) => v - box.min[i]));
	for (let i = 0; i < 3; i++) {
		box.min[i] -= diameter;
		box.max[i] += diameter;
	}
}
/** Extends drafting bounds where a fitted primitive can project beyond its declared footprint. */
export function enclose(p: FitPart, box: Bounds): Bounds {
	if (p.kind === 'ring') encloseRing(p, box);
	if (p.kind === 'frame' && p.members) encloseFrame(p, box, p.members);
	if (p.kind === 'pipe' && p.points.length > 2) encloseSpline(box);
	return box;
}
