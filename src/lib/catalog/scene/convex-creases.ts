import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three/webgpu';

type Face = { vertices: Vector3[]; normal: Vector3; edges: Edge[]; flat: Face[] };
type Edge = { origin: Vector3; inward: Vector3 };
type HalfEdge = { face: Face; start: Vector3; end: Vector3; opposite: Vector3 };

// Weld geometric seams within 10 micrometres, independently of UV and material seams.
const key = (p: Vector3) => [p.x, p.y, p.z].map((x) => Math.round(x * 1e5)).join(',');
const distance = (p: Vector3, edge: Edge) => edge.inward.dot(p) - edge.inward.dot(edge.origin);

/** Chamfer width in metres, limited to leave a flat land on narrow members. */
export function modelBevel(smallestM: number, largestM: number) {
	return Math.min(smallestM * 0.24, largestM >= 6 ? 0.45 : 0.15);
}

function connect(a: HalfEdge, b: HalfEdge) {
	const cosine = a.face.normal.dot(b.face.normal);
	if (cosine > 0.99999) {
		a.face.flat.push(b.face);
		b.face.flat.push(a.face);
		return;
	}
	// At a convex fold the opposite corner lies behind the first face.
	const behind = b.opposite.clone().sub(a.start).dot(a.face.normal);
	if (behind >= -1e-5 || cosine > Math.cos(Math.PI / 6)) return;
	for (const side of [a, b]) {
		const direction = side.end.clone().sub(side.start).normalize();
		side.face.edges.push({ origin: side.start, inward: side.face.normal.clone().cross(direction) });
	}
}

function meshFaces(geometry: BufferGeometry) {
	const positions = geometry.getAttribute('position');
	const faces: Face[] = [];
	const seams = new Map<string, HalfEdge>();
	for (let i = 0; i < positions.count; i += 3) {
		const vertices = [i, i + 1, i + 2].map((j) => new Vector3().fromBufferAttribute(positions, j));
		const [a, b, c] = vertices;
		const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
		const face: Face = { vertices, normal, edges: [], flat: [] };
		faces.push(face);
		for (let j = 0; j < 3; j++) {
			const start = vertices[j],
				end = vertices[(j + 1) % 3];
			const half = { face, start, end, opposite: vertices[(j + 2) % 3] };
			const from = key(start),
				to = key(end);
			const other = seams.get(to + '/' + from);
			if (other) connect(half, other);
			else seams.set(from + '/' + to, half);
		}
	}
	return faces;
}

function faceCreases(face: Face, radius: number) {
	const nearby = [...face.edges, ...face.flat.flatMap((other) => other.edges)];
	return nearby
		.filter((edge) => {
			const distances = face.vertices.map((vertex) => distance(vertex, edge));
			const nearest = Math.min(...distances);
			return nearest >= -1e-5 && nearest < radius;
		})
		.slice(0, 4);
}

/** Linear distances to nearby convex folds in units of bevel radius. Invisible triangulation
 * diagonals inherit their neighbour's boundary edges. All inputs are unindexed local metres. */
export function creaseChart(geometry: BufferGeometry, radius: number) {
	const count = geometry.getAttribute('position').count;
	const chart = new Float32Array(count * 4).fill(2);
	if (radius > 0) {
		meshFaces(geometry).forEach((face, i) => {
			const edges = faceCreases(face, radius);
			face.vertices.forEach((vertex, j) => {
				edges.forEach((edge, k) => {
					chart[(3 * i + j) * 4 + k] = Math.max(0, distance(vertex, edge) / radius);
				});
			});
		});
	}
	geometry.setAttribute('creaseDistance', new Float32BufferAttribute(chart, 4));
}
