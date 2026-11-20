import type { Vec3 } from '../../parametrik/types';
import { surface } from '../parts';

/** Casts evenly spaced collars into the glazing reveal, centred at the storey's eye level. */
export function bandCollars(span: number, depth: number, reveal: number, z: number) {
	const count = span < 5 ? span / 1.25 : Math.round(span / 1.875),
		pitch = (span - 1.5) / count,
		outer = Math.min(0.4, pitch * 0.43),
		inner = outer * 0.75;
	const points: Vec3[] = [],
		triangles: number[] = [];
	function collar(x: number, y: number, dx: number, dy: number) {
		const start = points.length;
		for (let i = 0; i < 32; i++) {
			const a = (Math.PI * i) / 16;
			for (const [r, h] of [
				[outer, 0],
				[outer, 0.12],
				[inner, 0.12],
				[inner, 0]
			]) {
				const u = r * Math.cos(a);
				points.push([x + dx * h - dy * u, y + dy * h + dx * u, z + r * Math.sin(a)]);
			}
		}
		for (let i = 0; i < 32; i++)
			for (let j = 0; j < 4; j++) {
				const a = start + 4 * i + j,
					b = start + 4 * ((i + 1) % 32) + j,
					c = start + 4 * ((i + 1) % 32) + ((j + 1) % 4),
					d = start + 4 * i + ((j + 1) % 4);
				triangles.push(a, b, c, a, c, d);
			}
	}
	for (const side of [-1, 1])
		for (let i = 0; i < count; i++)
			collar((i - (count - 1) / 2) * pitch, side * (depth / 2 - reveal), 0, side);
	collar(span / 2 - reveal, 0, 1, 0);
	return { ...surface('trim'), kind: 'mesh' as const, points, triangles, lines: [] };
}
