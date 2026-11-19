/** Weld one clipped shell at its local extraction resolution. Retain winding and face order. */
export function weldShell(positions: Float32Array, indices: Uint32Array, tolerance: number) {
	const vertices: number[] = [];
	const remap: number[] = [];
	for (let i = 0; i < positions.length; i += 3) {
		const x = positions[i],
			y = positions[i + 1],
			z = positions[i + 2];
		let j = 0;
		while (
			j < vertices.length &&
			Math.hypot(x - vertices[j], y - vertices[j + 1], z - vertices[j + 2]) > tolerance
		)
			j += 3;
		remap.push(j / 3);
		if (j === vertices.length) vertices.push(x, y, z);
	}
	if (vertices.length === positions.length) return { positions, indices };
	const faces: number[] = [];
	for (let i = 0; i < indices.length; i += 3) {
		const a = remap[indices[i]],
			b = remap[indices[i + 1]],
			c = remap[indices[i + 2]];
		if (a !== b && b !== c && a !== c) faces.push(a, b, c);
	}
	return { positions: Float32Array.from(vertices), indices: Uint32Array.from(faces) };
}
