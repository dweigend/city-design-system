import { crossProduct, displacement, dotProduct, type Vec3 } from '../../core/geometry';

type Joint = Readonly<{ id: string; position: Vec3 }>;

/** One closed volume cell of a lattice. Faces are loops of joint IDs wound outward. */
export type LatticeSolid = Readonly<{
	id: string;
	bay: string;
	faces: readonly (readonly string[])[];
}>;

/** Signed volume of loops wound one way, measured from their first joint. */
function signedVolume(loops: readonly (readonly Vec3[])[]) {
	const origin = loops[0][0];
	let volume = 0;
	for (const loop of loops) {
		const [a, ...rest] = loop.map((point) => displacement(origin, point));
		for (let i = 0; i + 1 < rest.length; i++)
			volume += dotProduct(a, crossProduct(rest[i], rest[i + 1])) / 6;
	}
	return volume;
}

/** Closes a solid from faces that are already wound consistently, each edge traversed once in
 * each direction. Reverses every face when the winding points inward, so it works for warped
 * and non-convex cells alike. */
export function closeSolid(id: string, bay: string, faces: readonly (readonly Joint[])[]) {
	const inward = signedVolume(faces.map((face) => face.map(({ position }) => position))) < 0;
	const wound = faces.map((face) => {
		const ids = face.map((joint) => joint.id);
		return Object.freeze(inward ? ids.reverse() : ids);
	});
	return Object.freeze<LatticeSolid>({ id, bay, faces: Object.freeze(wound) });
}

/** Signed volume in m³ of a closed, outward-wound solid. */
export function solidVolume(solid: LatticeSolid, position: (id: string) => Vec3) {
	return signedVolume(solid.faces.map((face) => face.map(position)));
}
