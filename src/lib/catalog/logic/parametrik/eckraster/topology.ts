import type { Cell, Grid, Point2 } from '../vocab';
import { cell, midpoint } from '../raster/geometry';
import { random } from '../random';
export type Vertex = {
	id: string;
	point: Point2;
	faces: string[];
	neighbors: string[];
	boundary: boolean;
};
export type Face = {
	id: string;
	vertices: [string, string, string, string];
	neighbors: (string | null)[];
};
export type Patch = { seed: number; vertices: Vertex[]; faces: Face[]; cells: Cell[] };
const edgeId = (a: string, b: string) => `edge:${[a, b].sort().join('/')}`;
/** Fixed five-sector triangular fan, subdivided twice. IDs encode ancestry, never positions.
 * Positive xy winding is the local contract (the author's xz convention differs).
 * Draws exactly five numbers from `random(seed)`: rim i lies at radius 17 + 1.3·uᵢ meters and
 * plan angle i·2π/5. IDs and their order do not depend on the seed. Returns a new patch.
 */
export function createPatch(seed = 42): Patch {
	const rng = random(seed),
		points = new Map<string, Point2>([['origin', [0, 0]]]);
	for (let i = 0; i < 5; i++) {
		const a = (i * 2 * Math.PI) / 5,
			r = 17 + rng() * 1.3;
		points.set(`rim${i}`, [r * Math.cos(a), r * Math.sin(a)]);
	}
	let polygons = Array.from({ length: 5 }, (_, i) => ({
		id: `sector${i}`,
		vertices: ['origin', `rim${i}`, `rim${(i + 1) % 5}`]
	}));
	for (let pass = 0; pass < 2; pass++)
		polygons = polygons.flatMap((p) => {
			const center = `center:${p.id}`;
			points.set(
				center,
				cell(
					p.vertices.map((id) => points.get(id)!),
					p.id
				).center
			);
			return p.vertices.map((v, i) => {
				const next = p.vertices[(i + 1) % p.vertices.length],
					prev = p.vertices[(i + p.vertices.length - 1) % p.vertices.length];
				for (const w of [next, prev])
					points.set(edgeId(v, w), midpoint(points.get(v)!, points.get(w)!));
				return { id: `${p.id}/${i}`, vertices: [v, edgeId(v, next), center, edgeId(prev, v)] };
			});
		});
	return assemble(seed, points, polygons);
}
/**
 * Quads → patch: neighborhoods, edges and dual build cells. Independent of the origin
 * of the mesh (fan in L10, distorted grid of the world in L11).
 */
export function assemble(
	seed: number,
	points: Map<string, Point2>,
	polygons: { id: string; vertices: string[] }[]
): Patch {
	const faces: Face[] = polygons.map((p) => ({
		...p,
		vertices: p.vertices as Face['vertices'],
		neighbors: [null, null, null, null]
	}));
	const used = [...new Set(faces.flatMap((f) => f.vertices))].sort();
	const vertices: Vertex[] = used.map((id) => ({
		id,
		point: points.get(id)!,
		faces: [],
		neighbors: [],
		boundary: false
	}));
	const byId = new Map(vertices.map((v) => [v.id, v]));
	const edges = new Map<string, { face: Face; side: number }[]>();
	const boundaryEdges = new Set<string>();
	for (const face of faces)
		face.vertices.forEach((id, i) => {
			byId.get(id)!.faces.push(face.id);
			const next = face.vertices[(i + 1) % 4],
				key = edgeId(id, next);
			edges.set(key, [...(edges.get(key) ?? []), { face, side: i }]);
			for (const [a, b] of [
				[id, next],
				[next, id]
			])
				if (!byId.get(a)!.neighbors.includes(b)) byId.get(a)!.neighbors.push(b);
		});
	for (const incident of edges.values())
		for (const { face, side } of incident) {
			face.neighbors[side] = incident.find((x) => x.face !== face)?.face.id ?? null;
			if (incident.length === 1) {
				boundaryEdges.add(edgeId(face.vertices[side], face.vertices[(side + 1) % 4]));
				for (const id of [face.vertices[side], face.vertices[(side + 1) % 4]])
					byId.get(id)!.boundary = true;
			}
		}
	const centers = new Map(
		faces.map((f) => [
			f.id,
			cell(
				f.vertices.map((id) => points.get(id)!),
				f.id
			).center
		])
	);
	const cells = vertices.map((v) => {
		const polygon = v.faces.map((id) => centers.get(id)!);
		if (v.boundary) {
			polygon.push(v.point);
			for (const n of v.neighbors)
				if (boundaryEdges.has(edgeId(v.id, n))) polygon.push(midpoint(v.point, points.get(n)!));
		}
		const sortCenter = polygon.reduce(
			(a, q) => [a[0] + q[0] / polygon.length, a[1] + q[1] / polygon.length],
			[0, 0]
		);
		polygon.sort(
			(a, b) =>
				Math.atan2(a[1] - sortCenter[1], a[0] - sortCenter[0]) -
				Math.atan2(b[1] - sortCenter[1], b[0] - sortCenter[0])
		);
		v.faces.sort(
			(a, b) =>
				Math.atan2(centers.get(a)![1] - v.point[1], centers.get(a)![0] - v.point[0]) -
				Math.atan2(centers.get(b)![1] - v.point[1], centers.get(b)![0] - v.point[0])
		);
		v.neighbors.sort();
		return { ...cell(polygon, v.id), neighbors: v.neighbors };
	});
	return { seed, vertices, faces, cells };
}
/**
 * Patch as a grid on one `level`: `dual` gives the build cells, `slots` the faces; cell IDs get
 * the suffix `@level`, links are listed once per pair (smaller ID first). Order follows the
 * patch. Detached; `p` is not mutated.
 */
export function projection(p: Patch, view: 'dual' | 'slots', level = 0): Grid {
	const cells =
		view === 'dual'
			? p.cells.map((c) => ({
					...c,
					id: `${c.id}@${level}`,
					level,
					neighbors: c.neighbors.map((n) => `${n}@${level}`)
				}))
			: p.faces.map((f) => ({
					...cell(
						f.vertices.map((id) => p.vertices.find((v) => v.id === id)!.point),
						`${f.id}@${level}`,
						level
					),
					neighbors: f.neighbors.filter((n): n is string => n !== null).map((n) => `${n}@${level}`)
				}));
	return {
		kind: 'quad-irregular',
		cells,
		links: cells.flatMap((c) =>
			c.neighbors.filter((n) => c.id < n).map((n) => [c.id, n] as [string, string])
		),
		bounds: { min: [-19, -19], max: [19, 19] }
	};
}
/**
 * ID of the first build cell (patch order) containing `point` (meters, x/y), boundary included
 * with a 1e-8 tolerance; assumes counter-clockwise convex cells. `undefined` outside the patch.
 */
export function cellAt(p: Patch, point: Point2): string | undefined {
	return p.cells.find((c) =>
		c.polygon.every((a, i) => {
			const b = c.polygon[(i + 1) % c.polygon.length];
			return (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]) >= -1e-8;
		})
	)?.id;
}
