import { defaults } from '../../../config/city-structure';
import { required } from '../../core/invariant';
import { levelHeight, type CityLattice, type LatticePoint } from '../../domain/city-volume';

// Exact arithmetic: an exterior face has exactly one incident solid.
const exteriorIncidence = /* Exact arithmetic: one incident face is exterior. */ 1;

type Boundary = { roof: boolean; side: boolean; facadeDiagonal?: true };

/** Stable key in the lattice's undirected edge namespace. */
function edgeKey(a: string, b: string) {
	return JSON.stringify(a < b ? [a, b] : [b, a]);
}

function exposedFaces({ solids }: CityLattice) {
	const faces = new Map<string, { loop: readonly string[]; count: number }>();
	for (const { faces: loops } of solids) {
		for (const loop of loops) {
			const key = JSON.stringify([...loop].sort());
			const face = faces.get(key);
			if (face) face.count++;
			else faces.set(key, { loop, count: exteriorIncidence });
		}
	}
	return [...faces.values()]
		.filter(({ count }) => count === exteriorIncidence)
		.map(({ loop }) => loop);
}

function roofFace(points: readonly LatticePoint[]) {
	const [ox, oy, oz] = points[0].position;
	if (points.some(({ position: [, , z] }) => z !== oz)) return false;
	return (
		points.reduce((area, { position: [x, y] }, i) => {
			const [u, v] = points[(i + 1) % points.length].position;
			return area + (x - ox) * (v - oy) - (y - oy) * (u - ox);
		}, 0) > 0
	);
}

function addFacadeDiagonals(
	{ cells, faces }: CityLattice,
	nodes: ReadonlyMap<string, LatticePoint>,
	edges: Map<string, Boundary>
) {
	const incidence = new Map<string, number>();
	for (const { sideFaces } of cells) {
		for (const id of sideFaces) incidence.set(id, (incidence.get(id) ?? 0) + 1);
	}
	for (const {
		id,
		corners: [a, b, c, d]
	} of faces) {
		if (incidence.get(id) !== exteriorIncidence) continue;
		for (const [from, to] of [
			[a, c],
			[b, d]
		]) {
			const start = nodes.get(from);
			const end = nodes.get(to);
			if (!start || !end || from === to || (start.groundContact && end.groundContact)) continue;
			const key = edgeKey(from, to);
			const boundary = edges.get(key) ?? { roof: false, side: false };
			boundary.facadeDiagonal = true;
			edges.set(key, boundary);
		}
	}
}

/** Indexes exterior solid perimeters and diagonal pairs on exposed canonical bay sides.
 * Ground-only edges belong to the footing. */
export function shellEdges(lattice: CityLattice, nodes: ReadonlyMap<string, LatticePoint>) {
	const edges = new Map<string, Boundary>();
	for (const loop of exposedFaces(lattice)) {
		const points = loop.map((id) => required(nodes.get(id), 'solid joint'));
		const roof = roofFace(points);
		for (const [i, a] of points.entries()) {
			const b = points[(i + 1) % points.length];
			if (a.groundContact && b.groundContact) continue;
			const key = edgeKey(a.id, b.id);
			const edge = edges.get(key) ?? { roof: false, side: false };
			edge.roof ||= roof;
			edge.side ||= !roof;
			edges.set(key, edge);
		}
	}
	addFacadeDiagonals(lattice, nodes, edges);
	return edges;
}

/** Retains spanning edges on the shell, roof rims, and regularly spaced shell chords. */
export function isPrimaryEdge(
	boundary: Boundary | undefined,
	role: 'beam' | 'column' | 'brace',
	elevation: number,
	datumZ: number,
	levelHeightM = levelHeight
) {
	if (!boundary) return false;
	if (role === 'brace' && boundary.facadeDiagonal) return true;
	if (!boundary.roof && !boundary.side) return false;
	if (role !== 'beam') return true;
	const band = (elevation - datumZ) / levelHeightM;
	const level = Math.round(band);
	const onRing =
		datumZ + level * levelHeightM === elevation && level % defaults.ringIntervalLevels === 0;
	return boundary.side && (boundary.roof || onRing);
}
