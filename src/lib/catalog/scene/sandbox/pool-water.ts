import type { TerrainCell } from '../../logic/terrain-grid';
import type { Vec3 } from '../../logic/parametrik/types';

// Intersect each bed triangle with the common horizontal waterline. The
// shoreline then meets the same facets used for picking and support surveys.
function waterFace(face: Vec3[], level: number) {
	const shore: Vec3[] = [];
	for (const [i, a] of face.entries()) {
		const b = face[(i + 1) % 3];
		if (a[2] < level) shore.push([a[0], a[1], level]);
		if (a[2] < level === b[2] < level) continue;
		const t = (level - a[2]) / (b[2] - a[2]);
		shore.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), level]);
	}
	return shore.length === 4 ? [shore[0], shore[1], shore[2], shore[0], shore[2], shore[3]] : shore;
}

/** Horizontal water triangles clipped against the finished basin floor, in world metres. */
export function poolWaterTriangles(cell: TerrainCell) {
	const bank = cell.bank;
	if (!bank?.waterFaces || bank.water === undefined) return [];
	const triangles: Vec3[] = [];
	for (let i = 0; i < bank.waterFaces.length; i += 3)
		triangles.push(
			...waterFace(
				[
					bank.points[bank.waterFaces[i]],
					bank.points[bank.waterFaces[i + 1]],
					bank.points[bank.waterFaces[i + 2]]
				],
				bank.water
			)
		);
	return triangles;
}
