import { trackRiver, type ReachFrame } from './frame';
import { skirt } from './skirt';

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

const stationCount = 108;
const lateralCounts = [36, 28, 36] as const;
const stride = 1 + lateralCounts.reduce((sum, count) => sum + count, 0);
const channelMargin = 450;

function gridPoints(frame: ReachFrame, width: number, scale: number) {
	const points: Point[] = [];
	const riverAt = trackRiver(frame.course);
	const half = width / 2;
	for (let row = 0; row <= stationCount; row++) {
		const x = (row / stationCount - 0.5) * frame.length;
		const river = Math.min(
			half - channelMargin - 100,
			Math.max(-half + channelMargin + 100, riverAt(x))
		);
		const cuts = [-half, river - channelMargin, river + channelMargin, half];
		const lateral = (y: number) => {
			const { height, water } = frame.sample(x, y);
			points.push({
				x,
				y,
				z: height * scale,
				water: water * scale,
				depth: (water - height) * scale
			});
		};
		lateral(-half);
		for (const [band, count] of lateralCounts.entries()) {
			for (let column = 1; column <= count; column++) {
				lateral(cuts[band] + ((cuts[band + 1] - cuts[band]) * column) / count);
			}
		}
	}
	return points;
}

export function terrainMeshes(frame: ReachFrame, width: number, scale: number) {
	const points = gridPoints(frame, width, scale);
	const ground = mesh();
	const water = mesh();
	let lowest = Infinity;
	for (const { x, y, z } of points) {
		ground.positions.push(x, y, z);
		lowest = Math.min(lowest, z);
	}
	for (let row = 0; row < stationCount; row++) {
		for (let column = 0; column < stride - 1; column++) {
			const a = row * stride + column;
			const b = a + stride;
			for (const [i, j, k] of [
				[a, b, a + 1],
				[b, b + 1, a + 1]
			]) {
				ground.indices.push(i, j, k);
				addWater(water, [points[i], points[j], points[k]]);
			}
		}
	}
	return [
		{ id: 'ground', slot: 'ground', shape: ground },
		{ id: 'earth', slot: 'earth', shape: skirt(points, stride, stationCount, lowest - 4 * scale) },
		{ id: 'river', slot: 'water', shape: water }
	];
}
