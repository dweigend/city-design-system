import { crossProduct, displacement, dotProduct, type Vec3 } from '../../core/geometry';

type Joint = Readonly<{ id: string; position: Vec3 }>;

/** One closed volume cell of a lattice. Faces are loops of joint IDs wound outward. */
export type LatticeSolid = Readonly<{
	id: string;
	bay: string;
	faces: readonly (readonly string[])[];
}>;

function mean(points: readonly Vec3[]): Vec3 {
	const [x, y, z] = points.reduce(([a, b, c], [u, v, w]) => [a + u, b + v, c + w], [0, 0, 0]);
	return [x / points.length, y / points.length, z / points.length];
}

/** Newell normal of a possibly non-planar loop. */
function loopNormal(loop: readonly Vec3[]): Vec3 {
	let normal: Vec3 = [0, 0, 0];
	for (const [i, a] of loop.entries()) {
		const b = loop[(i + 1) % loop.length];
		normal = [
			normal[0] + (a[1] - b[1]) * (a[2] + b[2]),
			normal[1] + (a[2] - b[2]) * (a[0] + b[0]),
			normal[2] + (a[0] - b[0]) * (a[1] + b[1])
		];
	}
	return normal;
}

/** Winds every face away from the joint centroid. Lattice solids are star-shaped around it. */
export function closeSolid(id: string, bay: string, faces: readonly (readonly Joint[])[]) {
	const centre = mean([...new Map(faces.flat().map((j) => [j.id, j.position])).values()]);
	const wound = faces.map((face) => {
		const points = face.map(({ position }) => position);
		const outward = dotProduct(loopNormal(points), displacement(centre, mean(points))) > 0;
		const ids = face.map((joint) => joint.id);
		return Object.freeze(outward ? ids : ids.reverse());
	});
	return Object.freeze<LatticeSolid>({ id, bay, faces: Object.freeze(wound) });
}

/** Signed volume in m³ of a closed, outward-wound solid. */
export function solidVolume(solid: LatticeSolid, position: (id: string) => Vec3) {
	const origin = position(solid.faces[0][0]);
	let volume = 0;
	for (const face of solid.faces) {
		const [a, ...rest] = face.map((id) => displacement(origin, position(id)));
		for (let i = 0; i + 1 < rest.length; i++)
			volume += dotProduct(a, crossProduct(rest[i], rest[i + 1])) / 6;
	}
	return volume;
}
