import {
	crossProduct,
	displacement,
	dotProduct,
	interpolation,
	measurePolygon,
	type Vec2,
	type Vec3
} from '../../core/geometry';

export type Triangle = readonly [Vec3, Vec3, Vec3];
type Plane = (point: Vec3) => number;
type Face = readonly Vec3[];

const zero: Vec3 = /* Exact arithmetic: local origin. */ [0, 0, 0];

function determinant(a: Vec3, b: Vec3, c: Vec3) {
	return dotProduct(a, crossProduct(b, c));
}

/** Clips a loop to a half-space. A caller can intern its cut points across faces. */
function clipFace(face: Face, plane: Plane, cut = intersection): Vec3[] {
	const ring: Vec3[] = [];
	for (const [i, a] of face.entries()) {
		const b = face[(i + 1) % face.length];
		const da = plane(a);
		const db = plane(b);
		if (da <= 0) ring.push(a);
		if ((da < 0 && db > 0) || (da > 0 && db < 0)) ring.push(cut(a, b, da, db));
	}
	return ring;
}

function intersection(a: Vec3, b: Vec3, da: number, db: number) {
	return interpolation(a, b, da / (da - db));
}

function capLoop(points: Set<Vec3>, normal: Vec3) {
	const count = points.size;
	const center = [...points].reduce<Vec3>(
		([x, y, z], [a, b, c]) => [x + a / count, y + b / count, z + c / count],
		zero
	);
	const axis: Vec3 =
		/* Exact arithmetic: perpendicular axes for vertical walls and horizontal caps. */
		normal[2] === 0 ? [0, 0, 1] : [1, 0, 0];
	const other = crossProduct(normal, axis);
	const angle = (point: Vec3) => {
		const offset = displacement(center, point);
		return Math.atan2(dotProduct(offset, other), dotProduct(offset, axis));
	};
	return [...points].sort((a, b) => angle(a) - angle(b));
}

function clipSolid(faces: readonly Face[], normal: Vec3, plane: Plane): readonly Face[] {
	const vertices = new Set(faces.flat());
	if (![...vertices].some((p) => plane(p) > 0)) return faces;
	if (![...vertices].some((p) => plane(p) < 0)) return [];
	const cutPoints = new Set([...vertices].filter((p) => plane(p) === 0));
	const edges = new Map<Vec3, Map<Vec3, Vec3>>();
	const cut = (a: Vec3, b: Vec3, da: number, db: number) => {
		const existing = edges.get(a)?.get(b) ?? edges.get(b)?.get(a);
		if (existing) return existing;
		const point = intersection(a, b, da, db);
		let adjacent = edges.get(a);
		if (!adjacent) edges.set(a, (adjacent = new Map<Vec3, Vec3>()));
		adjacent.set(b, point);
		cutPoints.add(point);
		return point;
	};
	const kept = faces.map((face) => clipFace(face, plane, cut)).filter((face) => face.length >= 3);
	if (cutPoints.size >= /* Exact arithmetic: a polygon needs three vertices. */ 3)
		kept.push(capLoop(cutPoints, normal));
	return kept;
}

function sixVolume(faces: readonly Face[]) {
	let volume = 0;
	for (const [a, ...rest] of faces)
		for (let i = 1; i < rest.length; i++) volume += determinant(a, rest[i - 1], rest[i]);
	return volume;
}

/** Builds the footprint/height test in coordinates local to the candidate prism. */
export function createPrismFill(quad: readonly Vec2[], bottomZ: number, topZ: number) {
	const [x, y] = quad[0];
	const origin: Vec3 = [x, y, bottomZ];
	const local = (point: Vec3) => displacement(origin, point);
	const height = topZ - bottomZ;
	const area = measurePolygon(quad.map(([u, v]) => local([u, v, bottomZ]))).area;
	const walls = quad.map(([x, y], i) => {
		const [u, v] = quad[(i + 1) % quad.length];
		const normal: Vec3 =
			/* Exact arithmetic: clockwise normal of a CCW plan edge. */
			[v - y, x - u, 0];
		const start = local([x, y, bottomZ]);
		return { normal, plane: (point: Vec3) => dotProduct(normal, displacement(start, point)) };
	});
	const planes = /* Exact arithmetic: vertical axis normals for the prism caps. */ [
		...walls,
		{ normal: [0, 0, -1] as Vec3, plane: ([, , z]: Vec3) => -z },
		{ normal: [0, 0, 1] as Vec3, plane: ([, , z]: Vec3) => z - height }
	];

	function signedIntersection(triangle: Triangle) {
		const [a, b, c] = triangle.map(local);
		const signed = determinant(a, b, c);
		if (signed === 0) return 0;
		const [u, v] = signed > 0 ? [b, c] : [c, b];
		let faces: readonly Face[] = [
			[a, u, v],
			[zero, v, u],
			[zero, a, v],
			[zero, u, a]
		];
		for (const { normal, plane } of planes) {
			faces = clipSolid(faces, normal, plane);
			if (faces.length === 0) return 0;
		}
		return Math.sign(signed) * sixVolume(faces);
	}

	return {
		/** A clipped affine cap reaches each extremum at a retained or intersected vertex. */
		clears(triangles: readonly Triangle[], top: boolean) {
			let covered = 0;
			for (const triangle of triangles) {
				const clipped = walls.reduce<Vec3[]>(
					(face, { plane }) => clipFace(face, plane),
					triangle.map(local)
				);
				if (clipped.length >= 3) covered += measurePolygon(clipped).area;
				if (
					!clipped.every(([, , z]) => {
						const tolerance =
							/* Exact arithmetic: roundoff in edge/cap interpolation. */ 64 *
							Number.EPSILON *
							Math.max(Math.abs(z), height);
						return top ? z >= height - tolerance : z <= tolerance;
					})
				)
					return false;
			}
			const tolerance =
				/* Exact arithmetic: projected cap clipping and area roundoff. */ 256 *
				Number.EPSILON *
				area;
			return Math.abs(area - covered) <= tolerance;
		},
		/** Oriented cones from the local origin represent the winding of each solid. Intersecting
		 * them with the prism preserves that signed volume, including for non-convex shells. */
		filled(triangles: Iterable<Triangle>) {
			let volume = 0;
			let magnitude = 0;
			for (const triangle of triangles) {
				const contribution = signedIntersection(triangle);
				volume += contribution;
				magnitude += Math.abs(contribution);
			}
			const expected =
				/* Exact arithmetic: determinants give six times volume. */ 6 * area * height;
			const tolerance =
				/* Exact arithmetic: roundoff in clipping and signed volume accumulation. */ 256 *
				Number.EPSILON *
				(magnitude + expected);
			return expected > 0 && Math.abs(expected - volume) <= tolerance;
		}
	};
}
