import type { Vec3 } from '../parametrik/types';
import { quadGrid, type QuadCell } from './carrier';

type Patch = Readonly<{
	vertices: readonly { id: string; point: readonly [number, number] }[];
	faces: readonly {
		id: string;
		vertices: QuadCell['vertexIds'];
		neighbors: readonly (string | null)[];
	}[];
}>;

/** Adapt a flat counter-clockwise quad patch to a paintable plate, preserving face and side order. */
export function patchGrid(patch: Patch) {
	const points = new Map(
		patch.vertices.map(({ id, point: [x, y] }) => [id, [x, y, 0] satisfies Vec3])
	);
	const corner = (id: string) => {
		const point = points.get(id);
		if (!point) throw new Error(`Unknown patch vertex ${id}`);
		return point;
	};
	return quadGrid(
		patch.faces.map(({ id, vertices, neighbors }, index): QuadCell => {
			if (neighbors.length !== 4) throw new Error(`Expected four sides for ${id}`);
			const [a, b, c, d] = vertices.map(corner);
			return {
				id,
				index,
				corners: [a, b, c, d],
				vertexIds: vertices,
				center: [(a[0] + b[0] + c[0] + d[0]) / 4, (a[1] + b[1] + c[1] + d[1]) / 4, 0],
				neighbors: [neighbors[0], neighbors[1], neighbors[2], neighbors[3]],
				pad: 0.5,
				raised: false,
				buildable: true,
				chunk: 'plate'
			};
		})
	);
}
