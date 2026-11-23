import type { Vec3 } from '../../core/geometry';
import { fanAnchor } from './foundation-prism';

type Joint = Readonly<{ id: string; position: Vec3 }>;

/** One closed volume cell of a lattice. Faces are loops of joint IDs wound outward. */
export type LatticeSolid = Readonly<{
	id: string;
	bay: string;
	faces: readonly (readonly string[])[];
}>;

/** Signed volume of consistently wound loops. A geometric fan anchor gives both sides of
 * a warped face the same triangulation, including both rings of a clamped prism. */
function signedVolume<T>(loops: readonly (readonly T[])[], position: (value: T) => Vec3) {
	const [ox, oy, oz] = position(loops[0][0]);
	let volume = 0;
	for (const loop of loops) {
		const start = fanAnchor(loop, position);
		const [ax, ay, az] = position(loop[start]);
		let [bx, by, bz] = position(loop[(start + 1) % loop.length]);
		for (let i = 2; i < loop.length; i++) {
			const [cx, cy, cz] = position(loop[(start + i) % loop.length]);
			const [ux, uy, uz] = [bx - ox, by - oy, bz - oz];
			const [vx, vy, vz] = [cx - ox, cy - oy, cz - oz];
			volume +=
				((ax - ox) * (uy * vz - uz * vy) +
					(ay - oy) * (uz * vx - ux * vz) +
					(az - oz) * (ux * vy - uy * vx)) /
				6;
			bx = cx;
			by = cy;
			bz = cz;
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
	const clean = [];
	for (const face of faces) {
		const repeated = (joint: T, i: number) => joint.id === face.at(i - 1)?.id;
		const loop = face.some(repeated) ? face.filter((joint, i) => !repeated(joint, i)) : face;
		if (loop.length >= 3) clean.push(loop);
	}
	return clean;
}

/** Closes a solid from faces that are already wound consistently, each edge traversed once in
 * each direction. Reverses every face when the winding points inward, so it works for warped
 * and non-convex cells alike. */
export function closeSolid(id: string, bay: string, faces: readonly (readonly Joint[])[]) {
	const inward = signedVolume(faces, ({ position }) => position) < 0;
	const wound = faces.map((face) => {
		const ids = face.map((joint) => joint.id);
		return Object.freeze(inward ? ids.reverse() : ids);
	});
	return Object.freeze<LatticeSolid>({ id, bay, faces: Object.freeze(wound) });
}

/** Signed volume in m³ of a closed, outward-wound solid. */
export function solidVolume(solid: LatticeSolid, position: (id: string) => Vec3) {
	return signedVolume(
		solid.faces.map((face) => face.map(position)),
		(point) => point
	);
}

/** Counts solid edges incident to more than two faces and edges with inconsistent winding. */
export function solidEdgeFaults(faces: LatticeSolid['faces']) {
	const edges = new Map<string, { count: number; balance: number }>();
	for (const face of faces) {
		for (const [i, a] of face.entries()) {
			const b = face[(i + 1) % face.length];
			const forward = a < b;
			const key = JSON.stringify(forward ? [a, b] : [b, a]);
			let edge = edges.get(key);
			if (!edge) edges.set(key, (edge = { count: 0, balance: 0 }));
			edge.count++;
			edge.balance += forward ? 1 : -1;
		}
	}
	let nonManifold = 0;
	let open = 0;
	for (const { count, balance } of edges.values()) {
		if (count > 2) nonManifold++;
		else if (count !== 2 || balance !== 0) open++;
	}
	return { nonManifold, open };
}
