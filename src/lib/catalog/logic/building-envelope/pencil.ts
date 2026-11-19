import type { Vec3, MeshForm } from '../parametrik/types';
import type { EnvelopeMesh } from './contract';

function normal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
	const u = b.map((value, i) => value - a[i]);
	const v = c.map((value, i) => value - a[i]);
	const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
	const length = Math.hypot(...cross);
	return cross.map((value) => value / length) as Vec3;
}

/** Projects shell creases and storey contours into indexed world-space pencil paths. */
export function pencilForm(mesh: EnvelopeMesh, seams: Vec3[][]): MeshForm {
	const points: Vec3[] = [];
	for (let i = 0; i < mesh.positions.length; i += 3)
		points.push(mesh.origin.map((v, j) => v + mesh.positions[i + j]) as Vec3);
	const triangles = Array.from(mesh.indices);
	const neighbors = new Map<string, Vec3>();
	const lines: number[][] = [];
	for (let i = 0; i < triangles.length; i += 3) {
		const [a, b, c] = triangles.slice(i, i + 3);
		const n = normal(points[a], points[b], points[c]);
		for (const [start, end] of [
			[a, b],
			[b, c],
			[c, a]
		]) {
			const key = Math.min(start, end) + ',' + Math.max(start, end);
			const previous = neighbors.get(key);
			if (!previous) neighbors.set(key, n);
			else if (Math.hypot(n[0] - previous[0], n[1] - previous[1], n[2] - previous[2]) > 0.01)
				lines.push([start, end]);
		}
	}
	for (const seam of seams) {
		const path = seam.map((p) => points.push(p) - 1);
		lines.push([...path, path[0]]);
	}
	return { kind: 'mesh', points, triangles, lines };
}
