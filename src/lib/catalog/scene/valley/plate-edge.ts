import { BufferAttribute, BufferGeometry } from 'three/webgpu';

function boundary(side: number) {
	const last = side - 1;
	const perimeter: number[] = [];
	for (let column = 0; column < last; column++) perimeter.push(column);
	for (let row = 0; row < last; row++) perimeter.push(row * side + last);
	for (let column = last; column > 0; column--) perimeter.push(last * side + column);
	for (let row = last; row > 0; row--) perimeter.push(row * side);
	return perimeter;
}

/** Closes the four sides of a square sampled surface down to a flat base, in meters. */
export function plateEdge(top: BufferAttribute, baseY: number) {
	const perimeter = boundary(Math.sqrt(top.count));
	const vertices: number[] = [];
	const indices: number[] = [];
	perimeter.forEach((vertex, index) => {
		const x = top.getX(vertex);
		const z = top.getZ(vertex);
		vertices.push(x, top.getY(vertex), z, x, baseY, z);
		const a = 2 * index;
		const b = 2 * ((index + 1) % perimeter.length);
		indices.push(a, b, a + 1, a + 1, b, b + 1);
	});
	const edge = new BufferGeometry();
	edge.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
	edge.setIndex(indices);
	return edge;
}
