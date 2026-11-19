import type { Vec3 } from '../../parametrik/types';
import type { ObjectGeometry } from '../object-geometry';
import { surface } from '../parts';

// Continuous clockwise/counterclockwise rings carry the bevel through all four filleted corners.
function outline(w: number, d: number, r: number, inset: number, z: number): Vec3[] {
	const arc = Math.max(0.001, r - inset);
	return Array.from({ length: 4 }, (_, q) => {
		const x = (q === 0 || q === 3 ? 1 : -1) * (w / 2 - r),
			y = (q < 2 ? 1 : -1) * (d / 2 - r);
		return Array.from({ length: 13 }, (_, i): Vec3 => {
			const a = ((q + i / 12) * Math.PI) / 2;
			return [x + arc * Math.cos(a), y + arc * Math.sin(a), z];
		});
	}).flat();
}
/** Cast plinth with a 7.5 percent plan fillet and bevels on the upper and lower face. */
export function castPlinth(w: number, d: number, h: number, slot: string): ObjectGeometry {
	const r = Math.min(w, d) * 0.075,
		b = Math.min(r * 0.66, h * 0.24);
	const rings = [
		outline(w, d, r, b, 0),
		outline(w, d, r, 0, b),
		outline(w, d, r, 0, h - b),
		outline(w, d, r, b, h)
	];
	const n = rings[0].length,
		points = rings.flat(),
		triangles: number[] = [];
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n;
		for (let layer = 0; layer < 3; layer++) {
			const a = layer * n + i,
				c = layer * n + j;
			triangles.push(a, c, c + n, a, c + n, a + n);
		}
		if (i > 0 && i < n - 1) triangles.push(0, i + 1, i, 3 * n, 3 * n + i, 3 * n + i + 1);
	}
	return { ...surface(slot), kind: 'mesh', points, triangles, lines: [] };
}
