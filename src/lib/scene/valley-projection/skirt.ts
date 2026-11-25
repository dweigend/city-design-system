type Point = { x: number; y: number; z: number };
type Mesh = { kind: 'mesh'; positions: number[]; indices: number[] };

function addSide(mesh: Mesh, points: readonly Point[], bottom: number) {
	const start = mesh.positions.length / 3;
	for (const { x, y, z } of points) mesh.positions.push(x, y, z, x, y, bottom);
	for (let i = 1; i < points.length; i++) {
		const a = start + 2 * (i - 1);
		const b = a + /* Exact arithmetic: each skirt column contributes two vertices. */ 2;
		mesh.indices.push(
			a,
			a + 1,
			b,
			b,
			a + 1,
			b + 1,
			/* Exact arithmetic: the first vertex is the base fan origin. */ 0,
			b + 1,
			a + 1
		);
	}
}

export function skirt(sides: readonly (readonly Point[])[], bottom: number) {
	const earth: Mesh = {
		kind: 'mesh',
		positions: /* Exact arithmetic: base fan starts at the local XY origin. */ [0, 0, bottom],
		indices: []
	};
	for (const side of sides) addSide(earth, side, bottom);
	return earth;
}
