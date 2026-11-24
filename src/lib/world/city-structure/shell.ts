import { defaults } from '../../../config/city-structure';
import { required } from '../../core/invariant';
import { levelHeight, type CityLattice, type LatticePoint } from '../../domain/city-volume';

// Exact arithmetic: an exterior face has exactly one incident solid.
const exteriorIncidence = 1;

type Boundary = { roof: boolean; side: boolean };

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

/** Indexes member edges on exterior solid faces. Ground-only edges belong to the footing. */
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
	return edges;
}

/** Retains spanning edges on the shell, roof rims, and regularly spaced shell chords. */
export function primarySection(
	boundary: Boundary | undefined,
	role: 'beam' | 'column' | 'brace',
	elevation: number,
	datumZ: number
) {
	if (!boundary) return 'light';
	if (role !== 'beam') return 'heavy';
	const band = (elevation - datumZ) / levelHeight;
	const level = Math.round(band);
	const onRing =
		datumZ + level * levelHeight === elevation && level % defaults.ringIntervalLevels === 0;
	return boundary.side && (boundary.roof || onRing) ? 'heavy' : 'light';
}
