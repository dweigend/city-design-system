import type { Vec3 } from '../../parametrik/types';
import { surface } from '../parts';

type UV = [number, number];
const outer: UV[] = [
	[0, 0],
	[0.5, 0],
	[1, 0],
	[1, 0.5],
	[1, 1],
	[0.5, 1],
	[0, 1],
	[0, 0.5]
];
const cut: UV[] = [
	[0.25, 0.28],
	[0.31, 0.22],
	[0.69, 0.22],
	[0.75, 0.28],
	[0.75, 0.72],
	[0.69, 0.78],
	[0.31, 0.78],
	[0.25, 0.72]
];
function point(corners: Vec3[], u: number, v: number, inset: number): Vec3 {
	const [x, y, z] = [0, 1, 2].map(
		(k) =>
			(1 - v) * ((1 - u) * corners[0][k] + u * corners[1][k]) +
			v * ((1 - u) * corners[3][k] + u * corners[2][k])
	);
	const shrink = 1 - inset / Math.hypot(x, y);
	return [x * shrink, y * shrink, z];
}

const columns = 4,
	rows = 3;

function cellVertices(corners: Vec3[], col: number, row: number) {
	const vertices: Vec3[] = [];
	for (const inset of [0, 0.15])
		for (const [u, v] of [...outer, ...cut])
			vertices.push(point(corners, (col + u) / columns, (row + v) / rows, inset));
	return vertices;
}

/** Folds a continuous sheet around a grid of clear openings, each half of its column pitch. */
export function punchedFacade(corners: Vec3[]) {
	const points: Vec3[] = [],
		triangles: number[] = [];
	const quad = (a: number, b: number, c: number, d: number) => triangles.push(a, b, c, a, c, d);
	for (let row = 0; row < rows; row++)
		for (let col = 0; col < columns; col++) {
			const start = points.length;
			points.push(...cellVertices(corners, col, row));
			const boundary = [row === 0, col === columns - 1, row === rows - 1, col === 0];
			for (let i = 0; i < 8; i++) {
				const a = start + i,
					b = start + ((i + 1) % 8);
				quad(a, b, b + 8, a + 8);
				quad(a + 16, a + 24, b + 24, b + 16);
				quad(a + 8, b + 8, b + 24, a + 24);
				if (boundary[Math.floor(i / 2)]) quad(a, a + 16, b + 16, b);
			}
		}
	return { ...surface('punched'), kind: 'mesh' as const, points, triangles, lines: [] };
}
