type Point = { x: number; y: number; z: number };
type Mesh = { kind: 'mesh'; positions: number[]; indices: number[] };

function addSide(mesh: Mesh, points: readonly Point[], bottom: number) {
	const start = mesh.positions.length / 3;
	for (const { x, y, z } of points) mesh.positions.push(x, y, z, x, y, bottom);
	for (let i = 1; i < points.length; i++) {
		const a = start + 2 * (i - 1);
		const b = a + 2;
		mesh.indices.push(a, a + 1, b, b, a + 1, b + 1, 0, b + 1, a + 1);
	}
}

/** The four border rows of the ground raster, south, east, north and west, each running
 * counterclockwise around the block. */
export function borderSides<P extends Point>(
	points: readonly P[],
	stride: number,
	stationCount: number
): P[][] {
	const end = stride * stationCount;
	return [
		Array.from({ length: stationCount + 1 }, (_, i) => points[i * stride]),
		points.slice(end, end + stride),
		Array.from({ length: stationCount + 1 }, (_, i) => points[end - i * stride + stride - 1]),
		points.slice(0, stride).reverse()
	];
}

export function skirt(
	points: readonly Point[],
	stride: number,
	stationCount: number,
	bottom: number
) {
	const earth: Mesh = { kind: 'mesh', positions: [0, 0, bottom], indices: [] };
	for (const side of borderSides(points, stride, stationCount)) addSide(earth, side, bottom);
	return earth;
}
