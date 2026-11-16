import type { Primitive, Vec3 } from '../types';
import type { Cell, Grid } from '../vocab';

/** Nearest story above this footprint; an open roof retains its full height. */
export function heightBudget(c: Cell, grid: Grid): number {
	const above = grid.cells.filter(
		(o) =>
			o.level > c.level && Math.hypot(o.center[0] - c.center[0], o.center[1] - c.center[1]) < 1e-6
	);
	return above.length ? (Math.min(...above.map((o) => o.level)) - c.level) * 4 - 0.12 : Infinity;
}
export function primitiveTop(p: Primitive): number {
	switch (p.kind) {
		case 'prism':
			return p.z + p.height;
		case 'box':
		case 'wedge':
		case 'frame':
			return p.position[2] + p.size[2];
		case 'pipe':
			return Math.max(...p.points.map((p) => p[2])) + p.radius;
		case 'polyline':
			return Math.max(...p.points.map((p) => p[2]));
		case 'capsule':
			return Math.max(p.from[2], p.to[2]) + p.radius;
		case 'membrane':
			return Math.max(...p.corners.map((p) => p[2]));
		case 'sphere':
			return p.position[2] + p.radius * (p.squash ?? 1);
		case 'dome':
			return p.position[2] + (p.height ?? p.radius);
		case 'ring':
			return p.position[2] + p.radius;
		case 'torus':
			return p.position[2] + (p.axis === 'x' ? p.radius : 0) + p.tube;
		case 'arch':
		case 'vault':
		case 'halfpipe':
			return p.position[2] + p.rise;
		case 'helix':
			return p.position[2] + p.height + p.thickness;
		default:
			return p.position[2] + p.height;
	}
}
/** Preserve a family's proportions while fitting all its parts below the next story. */
export function fitHeight(primitives: Primitive[], center: Vec3, budget: number): Primitive[] {
	const top = Math.max(center[2], ...primitives.map(primitiveTop));
	const scale = Math.min(1, budget / Math.max(0.001, top - center[2]));
	return scaleForm(primitives, center, scale);
}

/** Uniform scale about the cell origin, including the family's physical details. */
export function scaleForm(primitives: Primitive[], center: Vec3, scale: number): Primitive[] {
	if (scale === 1) return primitives;
	const point = (p: Vec3): Vec3 => p.map((v, i) => center[i] + (v - center[i]) * scale) as Vec3;
	return primitives.map((p) => {
		switch (p.kind) {
			case 'prism':
				return {
					...p,
					polygon: p.polygon.map(([x, y]) => {
						const q = point([x, y, center[2]]);
						return [q[0], q[1]];
					}),
					z: point([0, 0, p.z])[2],
					height: p.height * scale
				};
			case 'box':
			case 'wedge':
			case 'frame':
				return {
					...p,
					position: point(p.position),
					size: p.size.map((v) => v * scale) as Vec3,
					...(p.kind === 'frame'
						? {
								bar: p.bar * scale,
								...(p.members
									? { members: p.members.map(([a, b]): [Vec3, Vec3] => [point(a), point(b)]) }
									: {})
							}
						: {}),
					...(p.kind === 'wedge' && p.low !== undefined ? { low: p.low * scale } : {})
				};
			case 'polyline':
				return { ...p, points: p.points.map(point) };
			case 'pipe':
				return { ...p, points: p.points.map(point), radius: p.radius * scale };
			case 'capsule':
				return { ...p, from: point(p.from), to: point(p.to), radius: p.radius * scale };
			case 'membrane':
				return {
					...p,
					corners: p.corners.map(point) as [Vec3, Vec3, Vec3, Vec3],
					sag: (p.sag ?? 0) * scale
				};
			default: {
				const q = { ...p, position: point(p.position) };
				for (const key of [
					'radius',
					'height',
					'innerRadius',
					'depth',
					'tube',
					'thickness',
					'width',
					'length',
					'rise'
				] as const)
					if (typeof (q as unknown as Record<string, unknown>)[key] === 'number')
						(q as unknown as Record<string, unknown>)[key] =
							(q as unknown as Record<string, number>)[key] * scale;
				return q;
			}
		}
	});
}
