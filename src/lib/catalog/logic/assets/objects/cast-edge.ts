import type { Vec3 } from '../../parametrik/types';
import { surface } from '../parts';

type XY = [number, number];
function outline(w: number, d: number, inset: number, door: boolean, radius: number): XY[] {
	const points: XY[] = [];
	for (let q = 0; q < 4; q++) {
		const cx = (q === 0 || q === 3 ? 1 : -1) * (w / 2 - radius),
			cy = (q < 2 ? 1 : -1) * (d / 2 - radius);
		for (let i = 0; i <= 8; i++) {
			const a = ((q + i / 8) * Math.PI) / 2;
			points.push([cx + (radius - inset) * Math.cos(a), cy + (radius - inset) * Math.sin(a)]);
		}
		if (q === 1 && door) {
			const x = -w / 2 + inset;
			points.push([x, 0.55], [x + 0.35, 0.55], [x + 0.35, -0.55], [x, -0.55]);
		}
	}
	return points;
}
// The centre fan closes the round corners. Five triangles close the two jambs.
function closingFaces(n: number, door: boolean) {
	const faces: number[][] = [];
	for (let i = 0; i < n; i++) {
		if (door && i >= 17 && i <= 21) continue;
		faces.push([n, i, (i + 1) % n]);
	}
	if (door) faces.push([17, 18, 19], [17, 19, n], [19, 20, n], [20, 21, 22], [20, 22, n]);
	return faces;
}

function closeEnd(points: Vec3[], start: number, n: number, door: boolean, top: boolean) {
	const centre = points.length;
	points.push([0, 0, points[start][2]]);
	return closingFaces(n, door).flatMap((face) =>
		(top ? face : face.reverse()).map((i) => (i === n ? centre : start + i))
	);
}

/** Casts the outside edge as a quarter-round at the roof or at the foot of a storey. */
export function castCourse(
	w: number,
	d: number,
	z: number,
	height: number,
	roof: boolean,
	radius: number
) {
	const points: Vec3[] = [],
		triangles: number[] = [];
	function station(inset: number, level: number) {
		const ring = outline(w, d, inset, !roof, radius);
		const start = points.length,
			n = ring.length;
		for (const [x, y] of ring) points.push([x, y, level]);
		if (start)
			for (let i = 0; i < n; i++) {
				const a = start - n + i,
					b = start - n + ((i + 1) % n);
				triangles.push(a, b, b + n, a, b + n, a + n);
			}
	}
	if (roof) station(0, z);
	for (let i = 0; i <= 8; i++) {
		const t = ((roof ? i : 8 - i) * Math.PI) / 16;
		station(
			Math.min(radius - 0.001, radius * (1 - Math.cos(t))),
			roof ? z + height - radius + radius * Math.sin(t) : z + radius - radius * Math.sin(t)
		);
	}
	if (!roof) station(0, z + height);
	const n = outline(w, d, 0, !roof, radius).length,
		last = points.length - n;
	triangles.push(
		...closeEnd(points, 0, n, !roof, false),
		...closeEnd(points, last, n, !roof, true)
	);
	return { ...surface('body'), kind: 'mesh' as const, points, triangles, lines: [] };
}
