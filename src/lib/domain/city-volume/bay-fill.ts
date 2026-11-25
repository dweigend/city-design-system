import { bounds, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { createPolygonIndex } from '../../core/polygon-index';
import { readLatticeBay } from './bay-object';
import { createPrismFill, type Triangle } from './fill-volume';
import { fanTriangles } from './foundation-prism';
import type { CityLattice } from './frame';

const positionTriangles = (ring: Parameters<typeof fanTriangles>[0]) =>
	fanTriangles(ring).map(([a, b, c]): Triangle => [a.position, b.position, c.position]);

function indexSolids(lattice: CityLattice) {
	const joints = new Map(lattice.nodes.map((node) => [node.id, node]));
	return createPolygonIndex(
		lattice.solids.map(({ id, faces }) => {
			const triangles = faces.flatMap((face) =>
				positionTriangles(face.map((key) => required(joints.get(key), 'fill joint')))
			);
			const {
				min: [x, y, minZ],
				max: [u, v, maxZ]
			} = required(bounds(triangles.flat()), 'solid bounds');
			const outline: readonly Vec2[] = [
				[x, y],
				[u, y],
				[u, v],
				[x, v]
			];
			return { id, outline, minZ, maxZ, triangles };
		})
	);
}

const solidIndexes = new WeakMap<CityLattice, ReturnType<typeof indexSolids>>();

/** Reads a containment predicate for convex CCW storey footprints in an addressed bay.
 * The prism must clear both triangulated caps over its own footprint. The model solids
 * tessellate the fill with disjoint interiors, so the sum of signed intersections measures
 * coverage, including pieces assigned to adjacent bays. */
export function readBayFill(lattice: CityLattice, id: string) {
	const { floor, ceiling } = readLatticeBay(lattice, id);
	const low = positionTriangles(floor);
	const high = positionTriangles(ceiling);
	let index = solidIndexes.get(lattice);
	if (!index) {
		index = indexSolids(lattice);
		solidIndexes.set(lattice, index);
	}
	const solids = index;
	return (quad: readonly Vec2[], bottomZ: number, topZ: number) => {
		const prism = createPrismFill(quad, bottomZ, topZ);
		if (!prism.clears(low, false) || !prism.clears(high, true)) return false;
		const candidates = solids.readCandidates(quad);
		return prism.filled(
			candidates.flatMap(({ minZ, maxZ, triangles }) =>
				minZ < topZ && maxZ > bottomZ ? triangles : []
			)
		);
	};
}
