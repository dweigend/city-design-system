import { buildObject } from '../assets';
import type { Primitive } from '../parametrik/types';
import type { FitPart } from './types';
import type { Point } from './types';
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function measures(p: FitPart | Primitive): number[] {
	switch (p.kind) {
		case 'box':
		case 'frame':
		case 'wedge':
			return p.size;
		case 'sphere':
			return [p.radius, p.radius * (p.squash ?? 1)];
		case 'dome':
			return [p.radius, p.height ?? p.radius];
		case 'cone':
		case 'cylinder':
			return [p.radius, p.height];
		case 'capsule':
			return [p.radius, distance(p.from, p.to)];
		case 'pipe':
			return [p.radius, ...p.points.slice(1).map((q, i) => distance(q, p.points[i]))];
		case 'torus':
			return [p.radius, p.tube];
		case 'ring':
			return [p.radius, p.depth, p.innerRadius];
		case 'vault':
		case 'arch':
		case 'halfpipe':
			return [p.width, p.length, p.rise];
		case 'helix':
			return [p.radius, p.innerRadius, p.height, p.thickness];
		case 'prism':
			return [
				p.height,
				...p.polygon.map(([x, y], i) => {
					const b = p.polygon[(i + 1) % p.polygon.length];
					return Math.hypot(b[0] - x, b[1] - y);
				})
			];
		case 'mesh':
		case 'polyline':
			return p.points.slice(1).map((q, i) => distance(q, p.points[i]));
		case 'membrane':
			return p.corners.map((q, i) => distance(q, p.corners[(i + 1) % 4]));
	}
}
const uniform = (s: number[]) =>
	s.length > 0 &&
	s.every(
		(n) => Number.isFinite(n) && n >= 0.85 - 1e-9 && n <= 1.15 + 1e-9 && Math.abs(n - s[0]) < 1e-7
	);
/** Checks independent local metre dimensions or recovers them from a registered rigid member's source. */
export function invalidScale(p: FitPart) {
	const scale = p.scale;
	if (scale || p.nativeSize) {
		if (!scale || !uniform(scale)) return true;
		return (
			p.kind === 'box' &&
			p.nativeSize?.some(
				(d, i) => !Number.isFinite(d) || d <= 0 || Math.abs(p.size[i] - d * scale[i]) > 1e-8
			)
		);
	}
	const source = p.source;
	if (
		!source ||
		source.objectId.startsWith('primitive-') ||
		source.member === undefined ||
		source.seed === undefined
	)
		return false;
	const native = buildObject(source.objectId, source.variant, source.seed).parts[source.member];
	if (!native || native.kind !== p.kind) return true;
	const dimensions = measures(native),
		world = measures(p);
	return (
		dimensions.length !== world.length ||
		!uniform(dimensions.flatMap((d, i) => (d > 1e-9 ? [world[i] / d] : [])))
	);
}
