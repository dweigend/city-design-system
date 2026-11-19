import { expect, test } from 'bun:test';
import { planNetwork, type NetworkInput } from './index';

type Point = [number, number];
function segmentsApart(a: Point, b: Point, polygon: readonly Point[]) {
	// Separating-axis test for a convex cell and a line segment, including its normal.
	const normals = polygon.map(([x, y], i) => {
		const q = polygon[(i + 1) % polygon.length];
		return [q[1] - y, x - q[0]];
	});
	normals.push([a[1] - b[1], b[0] - a[0]]);
	return normals.some(([x, y]) => {
		const dot = (p: Point) => x * p[0] + y * p[1];
		const vertices = polygon.map(dot);
		return (
			Math.max(dot(a), dot(b)) <= Math.min(...vertices) + 1e-7 ||
			Math.min(dot(a), dot(b)) >= Math.max(...vertices) - 1e-7
		);
	});
}
test('the full width clears every body and a rotated blocked cell between samples', () => {
	const obstacle = {
		position: [0, 0, 0] as [number, number, number],
		size: [6, 4, 8] as [number, number, number]
	};
	const cell: Point[] = [
		[7.9, 0],
		[8, -0.15],
		[8.1, 0],
		[8, 0.15]
	];
	const input: NetworkInput = {
		houses: [
			[-10, 0],
			[12, 0],
			[18, 4]
		].map(([x, y], i) => ({
			id: String(i),
			entrance: [x, y],
			obstacles: i === 0 ? [obstacle] : []
		})),
		blockedCells: [cell],
		terrain: () => 0,
		ensembleArea: 1000
	};
	const net = planNetwork(input, 11);
	const body: Point[] = [
		[-4.625, -3.625],
		[4.625, -3.625],
		[4.625, 3.625],
		[-4.625, 3.625]
	];
	for (const e of net.edges) {
		const start = e.points[0],
			end = e.points[e.points.length - 1];
		for (const polygon of [cell, body])
			expect(segmentsApart([start[0], start[1]], [end[0], end[1]], polygon)).toBe(true);
	}
});
test('nearby parallel desire lines share a trunk and keep their short entrance spurs', () => {
	const input: NetworkInput = {
		houses: [
			[0, 0],
			[20, 0],
			[2, 2],
			[18, 2]
		].map(([x, y], i) => ({
			id: String(i),
			entrance: [x, y],
			obstacles: []
		})),
		blockedCells: [],
		terrain: () => 0,
		ensembleArea: 1000
	};
	const net = planNetwork(input, 2);
	expect(net.length).toBeLessThanOrEqual(24);
	expect(net.nodes.filter((n) => n.kind === 'fork')).toHaveLength(2);
});
