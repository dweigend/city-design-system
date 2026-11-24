/** Module: Pairs addressed planar faces and reads their boundaries. */
import { required } from '../invariant';
import { encodePair } from '../ref';

/** An addressed face with an implicitly closed, consistently wound ring. */
export type PlanarFace = Readonly<{ id: string; vertexIds: readonly string[] }>;

/** A face with one neighbor ID or null per directed side, in ring order. */
export type PlanarCell = PlanarFace & Readonly<{ neighbors: readonly (string | null)[] }>;

/** A directed side in the face ring's winding. */
export type PlanarSide = readonly [from: string, to: string];

type Edge = {
	from: string;
	to: string;
	faceId: string;
	side: number;
	opposite?: Readonly<{ id: string; side: number; reversed: boolean }>;
};

/** The first side of an undirected edge and the address of its second side, if present. */
export type EdgeIncidence = Readonly<Edge>;

function pairEdges(faces: readonly PlanarFace[]) {
	const edges = new Map<string, Edge>();
	for (const { id, vertexIds } of faces) {
		for (let side = 0; side < vertexIds.length; side++) {
			const from = vertexIds[side];
			const to = vertexIds[(side + 1) % vertexIds.length];
			const key = encodePair(from, to);
			const edge = edges.get(key);
			if (!edge) edges.set(key, { from, to, faceId: id, side });
			else {
				if (edge.opposite || edge.faceId === id)
					throw new RangeError('Repeated or non-manifold planar edge ' + key);
				edge.opposite = { id, side, reversed: edge.from === to };
			}
		}
	}
	return edges.values();
}

/** Reads detached, frozen edge incidences in first-face, first-side order.
 * Repeated edges in a face and edges with more than two faces throw RangeError. */
export function readEdgeIncidence(faces: readonly PlanarFace[]): readonly EdgeIncidence[] {
	return Object.freeze(
		Array.from(pairEdges(faces), (edge) => {
			if (edge.opposite) Object.freeze(edge.opposite);
			return Object.freeze(edge);
		})
	);
}

/** Snapshots faces with per-side neighbors, and directed boundary sides in first-incidence order.
 * Face IDs must be unique. Frozen rings are shared. Other output data is detached and frozen. */
export function createPlanarTopology(faces: readonly PlanarFace[]): Readonly<{
	faces: readonly PlanarCell[];
	boundary: readonly PlanarSide[];
}> {
	const cells = faces.map(({ id, vertexIds }) => ({
		id,
		vertexIds: Object.isFrozen(vertexIds) ? vertexIds : Object.freeze([...vertexIds]),
		neighbors: vertexIds.map((): string | null => null)
	}));
	const neighbors = new Map<string, (string | null)[]>();
	for (const cell of cells) neighbors.set(cell.id, cell.neighbors);
	const boundary: PlanarSide[] = [];
	for (const { from, to, faceId, side, opposite } of pairEdges(faces)) {
		if (!opposite) boundary.push(Object.freeze([from, to]));
		else {
			required(neighbors.get(faceId), 'first incident face')[side] = opposite.id;
			required(neighbors.get(opposite.id), 'second incident face')[opposite.side] = faceId;
		}
	}
	for (const cell of cells) {
		Object.freeze(cell.neighbors);
		Object.freeze(cell);
	}
	return Object.freeze({ faces: Object.freeze(cells), boundary: Object.freeze(boundary) });
}

/** Keeps faces in first request order. Retains metadata and rings by reference, filters side
 * neighbors, and returns frozen boundary sides plus a membership query for incident vertices. */
export function readPlanarSubset<Face extends PlanarCell>(
	faces: readonly Face[],
	ids: readonly string[]
): Readonly<{
	faces: readonly (Omit<Face, 'neighbors'> & PlanarCell)[];
	boundary: readonly PlanarSide[];
	hasVertex(id: string): boolean;
}> {
	const byId = new Map<string, Face>();
	for (const face of faces) byId.set(face.id, face);
	const selected = new Set(ids);
	const vertices = new Set<string>();
	const boundary: PlanarSide[] = [];
	const subset = Array.from(selected, (id) => {
		const face = required(byId.get(id), 'selected plan cell');
		const { vertexIds } = face;
		const neighbors = face.neighbors.map((neighbor, side) => {
			const from = vertexIds[side];
			vertices.add(from);
			if (neighbor !== null && selected.has(neighbor)) return neighbor;
			boundary.push(Object.freeze([from, vertexIds[(side + 1) % vertexIds.length]]));
			return null;
		});
		return Object.freeze({ ...face, neighbors: Object.freeze(neighbors) });
	});
	return Object.freeze({
		faces: Object.freeze(subset),
		boundary: Object.freeze(boundary),
		hasVertex: (id: string) => vertices.has(id)
	});
}

/** A vertex's adjacent IDs and the subset reached by edges on the requested boundary. */
export type PlanarVertex = Readonly<{
	id: string;
	neighbors: readonly string[];
	boundary: readonly string[];
}>;

/** Reads frozen vertex adjacency in first-incidence order. By default an edge with one
 * incident face marks its endpoints as boundary vertices. Supply a predicate for other cuts. */
export function readVertexAdjacency(
	faces: readonly PlanarFace[],
	isBoundary: (faceId: string, oppositeId: string | null) => boolean = (_, oppositeId) =>
		oppositeId === null
): readonly PlanarVertex[] {
	const vertices = new Map<string, { id: string; neighbors: string[]; boundary: string[] }>();
	function connect(from: string, to: string, boundary: boolean) {
		let vertex = vertices.get(from);
		if (!vertex) {
			vertex = { id: from, neighbors: [], boundary: [] };
			vertices.set(from, vertex);
		}
		vertex.neighbors.push(to);
		if (boundary) vertex.boundary.push(to);
	}
	for (const edge of pairEdges(faces)) {
		const boundary = isBoundary(edge.faceId, edge.opposite?.id ?? null);
		connect(edge.from, edge.to, boundary);
		connect(edge.to, edge.from, boundary);
	}
	return Object.freeze(
		Array.from(vertices.values(), (vertex) => {
			Object.freeze(vertex.neighbors);
			Object.freeze(vertex.boundary);
			return Object.freeze(vertex);
		})
	);
}

/** Walks one outer ring from its lexicographically first vertex. Shared sides must run
 * opposite ways and pass the seam predicate. Returns undefined unless faces join in a tree
 * and their remaining sides form one simple cycle. Returns a frozen ring. */
export function readFaceUnionBoundary(
	faces: readonly PlanarFace[],
	canJoin: (from: string, to: string) => boolean = () => true
): readonly string[] | undefined {
	if (faces.length === 1) {
		const { vertexIds } = faces[0];
		if (!vertexIds.length) return;
		let first = 0;
		for (let i = 1; i < vertexIds.length; i++) if (vertexIds[i] < vertexIds[first]) first = i;
		if (first === 0 && Object.isFrozen(vertexIds)) return vertexIds;
		return Object.freeze(vertexIds.slice(first).concat(vertexIds.slice(0, first)));
	}
	const next = new Map<string, string>();
	let start: string | undefined;
	let seams = 0;
	for (const { from, to, opposite } of pairEdges(faces)) {
		if (opposite) {
			if (!opposite.reversed || !canJoin(from, to)) return;
			seams++;
			continue;
		}
		if (next.has(from)) return;
		next.set(from, to);
		if (start === undefined || from < start) start = from;
	}
	if (seams !== faces.length - 1) return;
	const ring: string[] = [];
	let vertex = start;
	while (vertex !== undefined && ring.length < next.size) {
		ring.push(vertex);
		vertex = next.get(vertex);
		if (vertex === start) break;
	}
	if (start !== undefined && vertex === start && ring.length === next.size)
		return Object.freeze(ring);
}
