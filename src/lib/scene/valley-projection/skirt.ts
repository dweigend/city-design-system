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

export function skirt(
	points: readonly Point[],
	stride: number,
	stationCount: number,
	bottom: number
) {
	const earth: Mesh = { kind: 'mesh', positions: [0, 0, bottom], indices: [] };
	const end = stride * stationCount;
	const south = Array.from({ length: stationCount + 1 }, (_, i) => points[i * stride]);
	const north = Array.from(
		{ length: stationCount + 1 },
		(_, i) => points[end - i * stride + stride - 1]
	);
	const west = points.slice(0, stride).reverse();
	const east = points.slice(end, end + stride);
	for (const side of [south, east, north, west]) addSide(earth, side, bottom);
	return earth;
}
