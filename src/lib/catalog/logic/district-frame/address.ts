/** Physical seam identity is independent of incident face, winding and position. */
export function seamAddress(a: string, b: string) {
	const vertices: [string, string] = a < b ? [a, b] : [b, a];
	return { id: JSON.stringify(vertices), vertices };
}

/** Addresses a face side in its cyclic vertex ring. */
export function faceSeam(face: { vertexIds: readonly string[] }, side: number) {
	const ring = face.vertexIds;
	return seamAddress(ring[side], ring[(side + 1) % ring.length]);
}
