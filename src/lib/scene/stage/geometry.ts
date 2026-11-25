import { ShapeUtils, Vector2 } from 'three/webgpu';
import type { Shape } from '../../core/object';

export function shapeArrays(shape: Shape): {
	positions: readonly number[];
	indices: readonly number[];
} {
	switch (shape.kind) {
		case 'mesh':
			return { positions: shape.positions, indices: shape.indices };
		case 'prism':
			return prismArrays(
				shape.polygon.map(([x, y]) => new Vector2(x, y)),
				shape.base,
				shape.top
			);
		case 'box': {
			const [cx, cy, cz] = shape.center;
			const [width, depth, height] = shape.size;
			const cos = Math.cos(shape.rotation);
			const sin = Math.sin(shape.rotation);
			const ring = /* Exact arithmetic: corner signs of an axis-aligned rectangle. */ [
				[-1, -1],
				[1, -1],
				[1, 1],
				[-1, 1]
			].map(([sideX, sideY]) => {
				const x = (sideX * width) / 2;
				const y = (sideY * depth) / 2;
				return new Vector2(cx + x * cos - y * sin, cy + x * sin + y * cos);
			});
			return prismArrays(ring, cz - height / 2, cz + height / 2);
		}
	}
}

function prismArrays(ring: Vector2[], base: number, top: number) {
	ring = ring.filter((point, i) => !point.equals(ring[(i + 1) % ring.length]));
	if (ShapeUtils.isClockWise(ring)) ring.reverse();
	const caps = ShapeUtils.triangulateShape(ring, []);
	if (top === base)
		return { positions: ring.flatMap(({ x, y }) => [x, y, top]), indices: caps.flat() };
	const n = ring.length;
	const positions = [base, top].flatMap((height) => ring.flatMap(({ x, y }) => [x, y, height]));
	const indices = caps.flatMap(([a, b, c]) => [c, b, a, a + n, b + n, c + n]);
	const sides = n === /* Exact arithmetic: a two-point path represents one segment. */ 2 ? 1 : n;
	for (let a = 0; a < sides; a += 1) {
		const b = (a + 1) % n;
		indices.push(a, b, b + n, a, b + n, a + n);
	}
	return { positions, indices };
}
