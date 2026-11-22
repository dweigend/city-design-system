import type { HeightGrid } from '../../domain/valley';

type Point = { x: number; y: number; z: number; water: number; depth: number };
type Mesh = { kind: 'mesh'; positions: number[]; indices: number[] };

function waterVertex(point: Point, neighbor: Point): Point {
	const t = point.depth / (point.depth - neighbor.depth);
	const water = point.water + t * (neighbor.water - point.water);
	return {
		x: point.x + t * (neighbor.x - point.x),
		y: point.y + t * (neighbor.y - point.y),
		z: water,
		water,
		depth: 0
	};
}

function wetPolygon(triangle: readonly Point[]): Point[] {
	const polygon: Point[] = [];
	for (const [index, point] of triangle.entries()) {
		const next = triangle[(index + 1) % 3];
		if (point.depth >= 0) polygon.push(point);
		if (point.depth > 0 && next.depth < 0) polygon.push(waterVertex(point, next));
		if (point.depth < 0 && next.depth > 0) polygon.push(waterVertex(next, point));
	}
	return polygon;
}

function addWater(mesh: Mesh, triangle: readonly Point[]) {
	if (triangle.every(({ depth }) => depth <= 0)) return;
	const polygon = wetPolygon(triangle);
	if (polygon.length < 3) return;
	const base = mesh.positions.length / 3;
	for (const { x, y, water } of polygon) mesh.positions.push(x, y, water);
	for (let index = 1; index + 1 < polygon.length; index++)
		mesh.indices.push(base, base + index, base + index + 1);
}

function mesh(): Mesh {
	return { kind: 'mesh', positions: [], indices: [] };
}

function gridPoints(grid: HeightGrid, stride: number) {
	const points: Point[] = [];
	for (let row = 0; row < grid.side; row += stride) {
		for (let column = 0; column < grid.side; column += stride) {
			const index = row * grid.side + column;
			const z = grid.heights[index];
			const water = grid.waterHeights[index];
			points.push({
				x: grid.origin[0] + column * grid.cellSize,
				y: grid.origin[1] - row * grid.cellSize,
				z,
				water,
				depth: water - z
			});
		}
	}
	return points;
}

export function terrainMeshes(grid: HeightGrid) {
	const stride = 2;
	const side = (grid.side - 1) / stride + 1;
	const points = gridPoints(grid, stride);
	const ground = mesh();
	const water = mesh();
	for (const { x, y, z } of points) ground.positions.push(x, y, z);
	for (let row = 0; row < side - 1; row++) {
		for (let column = 0; column < side - 1; column++) {
			const nw = row * side + column;
			const ne = nw + 1;
			const sw = nw + side;
			const se = sw + 1;
			for (const [a, b, c] of [
				[nw, sw, ne],
				[sw, se, ne]
			]) {
				ground.indices.push(a, b, c);
				addWater(water, [points[a], points[b], points[c]]);
			}
		}
	}
	return [
		{ id: 'ground', slot: 'ground', shape: ground },
		{ id: 'river', slot: 'water', shape: water }
	];
}
