import { normalizeRing } from './normalize-ring';
import { epsilon } from './precision';
import type { Point2 } from '../parametrik/vocab';

function distance(a: Point2, b: Point2) {
	return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
function segmentDistance(p: Point2, a: Point2, b: Point2) {
	const dx = b[0] - a[0],
		dy = b[1] - a[1];
	const along = (p[0] - a[0]) * dx + (p[1] - a[1]) * dy;
	if (along <= 0) return distance(p, a);
	if (along >= dx * dx + dy * dy) return distance(p, b);
	return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / Math.hypot(dx, dy);
}
function clearance(ring: Point2[], i: number) {
	const p = ring[i];
	return Math.min(
		...ring.map((a, j) => {
			const k = (j + 1) % ring.length;
			if (i === j) return distance(p, ring[k]);
			if (i === k) return distance(p, a);
			return segmentDistance(p, a, ring[k]);
		})
	);
}
function arc(ring: Point2[], i: number, radius: number): Point2[] {
	const p = ring[i],
		a = ring[(i + ring.length - 1) % ring.length],
		b = ring[(i + 1) % ring.length];
	const incoming = Math.atan2(p[1] - a[1], p[0] - a[0]),
		outgoing = Math.atan2(b[1] - p[1], b[0] - p[0]);
	const turn = Math.atan2(Math.sin(outgoing - incoming), Math.cos(outgoing - incoming));
	const tangent = Math.tan(Math.abs(turn) / 2);
	if (tangent < epsilon || Math.PI - Math.abs(turn) < epsilon) return [p];
	// Each replacement lies inside its own corner disk, clear of every unrelated edge and disk.
	const setback = Math.min(radius * tangent, 0.49 * clearance(ring, i));
	if (setback < epsilon) return [p];
	const r = setback / tangent,
		side = Math.sign(turn);
	const x = p[0] - setback * Math.cos(incoming) - side * r * Math.sin(incoming);
	const y = p[1] - setback * Math.sin(incoming) + side * r * Math.cos(incoming);
	const count = Math.ceil(Math.abs(turn) / (Math.PI / 24));
	return Array.from({ length: count + 1 }, (_, j) => {
		// Construct tangent endpoints on their source edges to avoid trigonometric overshoot.
		if (j === 0 || j === count) {
			const neighbor = j === 0 ? a : b;
			const t = setback / distance(p, neighbor);
			return [p[0] + (neighbor[0] - p[0]) * t, p[1] + (neighbor[1] - p[1]) * t];
		}
		const angle = incoming - (side * Math.PI) / 2 + (turn * j) / count;
		return [x + r * Math.cos(angle), y + r * Math.sin(angle)];
	});
}
/** Samples tangent circular fillets on a simple open or closed ring, with at most 7.5° per chord. */
export function roundFootprint(points: readonly Point2[], radius: number): Point2[] {
	const ring = normalizeRing(points);
	if (!Number.isFinite(radius) || radius < 0)
		throw new RangeError('Expected a nonnegative finite radius');
	return radius && ring.length >= 3 ? ring.flatMap((_, i) => arc(ring, i, radius)) : ring;
}
