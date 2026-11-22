import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu';
import type { CellPoint } from '../../logic/cell-space';

type Ring = readonly CellPoint[];

/** Converts world metres to stage-local metres relative to the plot origin. */
export function stagePoint([x, y, z]: CellPoint, [ox, oy, oz]: CellPoint): CellPoint {
	return [x - ox, z - oz, oy - y];
}

/** Projects detached, convex outward rings from world metres into stage-local axes. */
export function faceGeometry(rings: readonly Ring[], origin: CellPoint): BufferGeometry {
	const positions: number[] = [];
	for (const ring of rings) {
		for (let i = 1; i + 1 < ring.length; i++) {
			for (const point of [ring[0], ring[i], ring[i + 1]])
				positions.push(...stagePoint(point, origin));
		}
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.computeVertexNormals();
	return geometry;
}
