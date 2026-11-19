import { bulb, drum, surface } from '../parts';
import { panel } from '../objects/forms';
import type { Vec3 } from '../../parametrik/types';
import type { ObjectGeometry } from '../object-geometry';
export type TreeForm = 'blocks' | 'folds' | 'clumps';
// One pleated paper tier. Alternate radii trace valleys and ridges in plan.
function foldedTier([x, y, z]: Vec3, r: number, h: number): ObjectGeometry {
	const n = 48,
		points: Vec3[] = [
			[x, y, z + h],
			[x, y, z]
		],
		triangles: number[] = [];
	for (let i = 0; i < n; i++) {
		const a = (i * 2 * Math.PI) / n,
			rr = r * (i % 2 ? 0.78 : 1);
		points.push([x + rr * Math.cos(a), y + rr * Math.sin(a), z]);
		const j = 2 + i,
			k = 2 + ((i + 1) % n);
		triangles.push(0, j, k, 1, k, j);
	}
	return { ...surface('planting'), kind: 'mesh', points, triangles, lines: [] };
}
// Stagger the low parkland shrubs along a shallow bend, with no central dominant crown.
function hedge([x, y, z]: Vec3, r: number, v: number, s: number): ObjectGeometry[] {
	const sizes = [0.39, 0.55, 0.46, 0.51, 0.42].slice(0, 3 + v);
	return sizes.map((size, i) => {
		const angle = (2 * Math.PI * i) / sizes.length + s * 0.45;
		const radius = size * r;
		return bulb(
			[x + 0.55 * r * Math.cos(angle), y + 0.43 * r * Math.sin(angle), z + radius * 0.52],
			radius,
			0.67,
			'planting'
		);
	});
}
function crown(form: TreeForm, [x, y, z]: Vec3, r: number, v: number, s: number): ObjectGeometry[] {
	if (form === 'clumps') return hedge([x, y, z], r, v, s);
	if (form === 'folds')
		return [0, 1, 2].map((i) =>
			foldedTier([x, y, z + i * r * (0.52 + 0.05 * v)], r * (1 - i * 0.23), r * (1.15 - 0.12 * i))
		);
	const n = 3 + 2 * v;
	return Array.from({ length: n }, (_, i) => {
		const a = i * 2.39996 + s * 0.5,
			offset = i === 0 ? 0 : r * 0.51,
			xx = x + offset * Math.cos(a),
			yy = y + offset * Math.sin(a);
		const size = r * (i === 0 ? 0.84 : 0.62 + (i % 3) * 0.05);
		return panel(xx, yy, z + 0.2 * r * (i % 3), size, size, size, 'planting');
	});
}
/** Groups v8 blocks, v4 folded tiers or v1 parkland clumps above a short visible trunk. */
export function treeCrown(
	form: TreeForm,
	origin: Vec3,
	r: number,
	v: number,
	s: number,
	wood: string
): ObjectGeometry[] {
	const [x, y, z] = origin,
		h = r * 0.19;
	return [drum(origin, Math.max(0.15, r * 0.16), h, wood), ...crown(form, [x, y, z + h], r, v, s)];
}
