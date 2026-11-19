import type { Vec3 } from '../../parametrik/types';
import { surface, drum } from '../parts';
import { series } from './series';

const lantern = series(
	'folded-lanterns',
	'deck',
	[3.75, 5, 6.25],
	['single-course', 'double-course', 'triple-course']
);
type Profile = 'twist' | 'waist' | 'flare' | 'stagger' | 'taper' | 'crown' | 'bell';
function radiusAt(shape: Profile, t: number) {
	switch (shape) {
		case 'twist':
			return 0.88;
		case 'waist':
			return 0.63 + 0.35 * Math.abs(2 * t - 1);
		case 'flare':
			return 0.55 + 0.43 * t;
		case 'stagger':
			return 0.86;
		case 'taper':
			return 0.98 - 0.42 * t;
		case 'crown':
			return 0.68 + 0.28 * t * t;
		case 'bell':
			return 0.65 + 0.33 * (1 - t) * (1 - t);
	}
}
// A panel has an actual opening. Its four corners follow adjacent rotated floor plates.
function punchedPanel(corners: Vec3[], slot: string) {
	const point = (u: number, v: number): Vec3 =>
		[0, 1, 2].map(
			(k) =>
				(1 - v) * ((1 - u) * corners[0][k] + u * corners[1][k]) +
				v * ((1 - u) * corners[3][k] + u * corners[2][k])
		) as Vec3;
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (let i = 0; i < 16; i++) {
		const a = (i * Math.PI) / 8 + Math.PI / 4,
			x = Math.cos(a),
			y = Math.sin(a),
			m = Math.max(Math.abs(x), Math.abs(y));
		points.push(
			point(0.5 + (0.5 * x) / m, 0.5 + (0.5 * y) / m),
			point(0.5 + 0.31 * x, 0.5 + 0.31 * y)
		);
		const j = 2 * i,
			k = (j + 2) % 32;
		const quad = (a: number, b: number, c: number, d: number) => triangles.push(a, b, c, a, c, d);
		quad(j, k, k + 1, j + 1);
		quad(j + 32, j + 33, k + 33, k + 32);
		quad(j + 1, k + 1, k + 33, j + 33);
		quad(j, j + 32, k + 32, k);
	}
	points.push(
		...points.map(([x, y, z]): Vec3 => {
			const scale = 1 - 0.15 / Math.hypot(x, y);
			return [x * scale, y * scale, z];
		})
	);
	return { ...surface(slot), kind: 'mesh' as const, points, triangles, lines: [] };
}
function sculpt(shape: Profile) {
	return lantern(
		shape + '-pierced-lantern',
		['foot', 'brass', 'punched'],
		(w) => w,
		(w, v) => {
			const r = w * 0.46,
				n = v + 1,
				faces = shape === 'crown' ? 5 : 4;
			const corner = (floor: number, k: number): Vec3 => {
				const t = floor / n,
					a = (k * 2 * Math.PI) / faces + floor * (shape === 'twist' ? 0.52 : 0.24),
					radius = r * radiusAt(shape, t);
				return [
					radius * Math.cos(a) + (shape === 'stagger' ? 0.09 * r * (floor % 2) : 0),
					radius * Math.sin(a),
					0.3 + floor * w * 0.56
				];
			};
			return [
				drum([0, 0, 0], r * 0.92, 0.3, 'foot'),
				...Array.from({ length: n }, (_, i) =>
					Array.from({ length: faces }, (_, j) =>
						punchedPanel(
							[corner(i, j), corner(i, j + 1), corner(i + 1, j + 1), corner(i + 1, j)],
							j % 2 ? 'brass' : 'punched'
						)
					)
				).flat()
			];
		}
	);
}
export const lanterns = (
	['twist', 'waist', 'flare', 'stagger', 'taper', 'crown', 'bell'] as const
).flatMap(sculpt);
