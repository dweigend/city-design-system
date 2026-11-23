import { crossProduct, displacement, dotProduct, type Vec3 } from '../../core/geometry';

type Joint = Readonly<{ id: string; position: Vec3 }>;

/** One closed volume cell of a lattice. Faces are loops of joint IDs wound outward. */
export type LatticeSolid = Readonly<{
	id: string;
	bay: string;
	faces: readonly (readonly string[])[];
}>;

function precedes([x, y, z]: Vec3, [a, b, c]: Vec3) {
	return x < a || (x === a && (y < b || (y === b && z < c)));
}

/** Signed volume of consistently wound loops. A geometric fan anchor gives both sides of
 * a warped face the same triangulation, including both rings of a clamped prism. */
function signedVolume(loops: readonly (readonly Vec3[])[]) {
	const origin = loops[0][0];
	let volume = 0;
	for (const loop of loops) {
		const start = loop.reduce((least, point, i) => (precedes(point, loop[least]) ? i : least), 0);
		const a = displacement(origin, loop[start]);
		for (let i = 1; i + 1 < loop.length; i++) {
			const b = displacement(origin, loop[(start + i) % loop.length]);
			const c = displacement(origin, loop[(start + i + 1) % loop.length]);
			volume += dotProduct(a, crossProduct(b, c)) / 6;
		}
	}
	return volume;
}

/** Face loops of two rings with matching corner order. */
export function prismFaces<T>(bottom: readonly T[], top: readonly T[]) {
	return [
		[...bottom].reverse(),
		top,
		...bottom.map((a, i) => {
			const j = (i + 1) % bottom.length;
			return [a, bottom[j], top[j], top[i]];
		})
	];
}

/** Removes collapsed edges and faces at terrain-clamped corners. */
export function cleanFaces<T extends Joint>(faces: readonly (readonly T[])[]) {
	return faces
		.map((face) => face.filter((joint, i) => joint.id !== face.at(i - 1)?.id))
		.filter((face) => face.length >= 3);
}

/** Closes a solid from faces that are already wound consistently, each edge traversed once in
 * each direction. Reverses every face when the winding points inward, so it works for warped
 * and non-convex cells alike. */
export function closeSolid(id: string, bay: string, faces: readonly (readonly Joint[])[]) {
	const clean = cleanFaces(faces);
	const inward = signedVolume(clean.map((face) => face.map(({ position }) => position))) < 0;
	const wound = clean.map((face) => {
		const ids = face.map((joint) => joint.id);
		return Object.freeze(inward ? ids.reverse() : ids);
	});
	return Object.freeze<LatticeSolid>({ id, bay, faces: Object.freeze(wound) });
}

/** Signed volume in m³ of a closed, outward-wound solid. */
export function solidVolume(solid: LatticeSolid, position: (id: string) => Vec3) {
	return signedVolume(solid.faces.map((face) => face.map(position)));
}
