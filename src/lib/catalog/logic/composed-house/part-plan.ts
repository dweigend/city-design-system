import { bounds, type Point2 } from '../ansicht/geometrie';
import type { Primitive } from '../parametrik/types';

/** Plan vertices of house stock, with rotation applied about a box's local centre. */
export function planPoints(p: Primitive): Point2[] {
	if (p.kind === 'prism') return p.polygon;
	if (p.kind === 'mesh') return p.points.map(([x, y]) => [x, y]);
	if (p.kind === 'pipe') return p.points.flatMap(([x, y]) => circle(x, y, p.radius));
	if (p.kind === 'capsule') return [p.from, p.to].flatMap(([x, y]) => circle(x, y, p.radius));
	if (p.kind === 'sphere' || p.kind === 'cylinder' || p.kind === 'dome')
		return circle(p.position[0], p.position[1], p.radius);
	if (p.kind === 'box' || p.kind === 'wedge') {
		const [w, d] = p.size,
			[x, y] = p.position,
			c = Math.cos(p.rotation ?? 0),
			s = Math.sin(p.rotation ?? 0);
		return [-0.5, 0.5].flatMap((u) =>
			[-0.5, 0.5].map((v): Point2 => [
				x + w / 2 + u * w * c - v * d * s,
				y + d / 2 + u * w * s + v * d * c
			])
		);
	}
	const b = bounds(p);
	return [b.min[0], b.max[0]].flatMap((x) => [b.min[1], b.max[1]].map((y): Point2 => [x, y]));
}
function circle(x: number, y: number, r: number): Point2[] {
	const outer = r / Math.cos(Math.PI / 12);
	return Array.from({ length: 12 }, (_, i) => [
		x + outer * Math.cos(((i + 0.5) * Math.PI) / 6),
		y + outer * Math.sin(((i + 0.5) * Math.PI) / 6)
	]);
}
