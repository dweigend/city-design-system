export type Box = readonly [number, number, number, number];
/** Bounds a fixed survey ring in world metres. Exact edges are materialized on first use. */
export function outline(points: readonly (readonly number[])[]) {
	const box: [number, number, number, number] = [Infinity, -Infinity, Infinity, -Infinity];
	for (const [x, y] of points) {
		box[0] = Math.min(box[0], x);
		box[1] = Math.max(box[1], x);
		box[2] = Math.min(box[2], y);
		box[3] = Math.max(box[3], y);
	}
	let edges: ReturnType<typeof outlineEdges> | undefined;
	return {
		box: box as Box,
		get edges() {
			return (edges ??= outlineEdges(points));
		}
	};
}
function outlineEdges(points: readonly (readonly number[])[]) {
	const polygon = points.map(([x, y]): [number, number] => [x, y]);
	return polygon.map((a, i) => {
		const b = polygon[(i + 1) % polygon.length];
		const box: Box = [
			Math.min(a[0], b[0]),
			Math.max(a[0], b[0]),
			Math.min(a[1], b[1]),
			Math.max(a[1], b[1])
		];
		return { a, b, box };
	});
}
export type Outline = ReturnType<typeof outline>;
/** Squared distance in square metres between axis-aligned survey bounds. */
export function squaredGap(a: Box, b: Box) {
	const x = Math.max(0, a[0] - b[1], b[0] - a[1]),
		y = Math.max(0, a[2] - b[3], b[2] - a[3]);
	return x * x + y * y;
}
