import type { Vec3 } from '../parametrik/types';

type Mesh = { points: Vec3[]; triangles: number[] };

function halfPlane(face: Vec3[], z: number, sign: number) {
	const polygon: Vec3[] = [];
	for (const [i, a] of face.entries()) {
		const b = face[(i + 1) % face.length];
		const da = sign * (a[2] - z),
			db = sign * (b[2] - z);
		if (da >= 0) polygon.push(a);
		if (da * db < 0) {
			const t = da / (da - db);
			polygon.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z]);
		}
	}
	return polygon;
}

/** Removes only the triangles behind the adjoining podium, preserving both exposed ends of a wall. */
export function cutPartyWall(wall: Mesh, hidden: readonly number[]): Mesh {
	const points: Vec3[] = [],
		triangles: number[] = [];
	const indices = new Map<Vec3, number>();
	function append(face: Vec3[]) {
		if (face.length < 3) return;
		const vertices = face.map((p) => {
			let i = indices.get(p);
			if (i === undefined) {
				i = points.length;
				points.push(p);
				indices.set(p, i);
			}
			return i;
		});
		for (let i = 1; i < vertices.length - 1; i++)
			triangles.push(vertices[0], vertices[i], vertices[i + 1]);
	}
	for (let i = 0; i < wall.triangles.length; i += 3) {
		const face = wall.triangles.slice(i, i + 3).map((j) => wall.points[j]);
		append(halfPlane(face, hidden[0], -1));
		append(halfPlane(face, hidden[1], 1));
	}
	return { points, triangles };
}
