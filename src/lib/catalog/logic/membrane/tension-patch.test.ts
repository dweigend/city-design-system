import { expect, test } from 'bun:test';
import { tensionPatch } from './index';
import type { Vec3 } from '../parametrik/types';

const quad: [Vec3, Vec3, Vec3, Vec3] = [
	[1, 2, 4],
	[7, 2, 4],
	[7, 8, 4],
	[1, 8, 4]
];
const triangle: [Vec3, Vec3, Vec3] = [
	[1, 2, 3],
	[5, 2, 6],
	[2, 1, 9]
];
const fabric = { tension: 2, pressure: 0 };

test('a twisted patch pins each surveyed grip at the shared endpoints of its two hems', () => {
	const grips: typeof quad = [quad[0], quad[1], [6, 9, 8], quad[3]];
	const patch = tensionPatch(grips, fabric);
	for (const [i, edge] of patch.edges.entries()) {
		expect(patch.positions[edge[0]]).toEqual(grips[i]);
		expect(edge.at(-1)).toBe(patch.edges[(i + 1) % grips.length][0]);
		expect(patch.positions[edge[0]]).not.toBe(grips[i]);
	}
});

test('a horizontal cable net gathers its free hems and sags below level grips', () => {
	const patch = tensionPatch(quad, fabric);
	const hem = patch.edges[0];
	const middle = patch.positions[hem[Math.floor(hem.length / 2)]];
	expect(middle[1]).toBeGreaterThan(quad[0][1]);
	expect(middle[2]).toBeLessThan(quad[0][2]);
});

test('positive pressure lifts a face and increased tension reduces its deflection', () => {
	const height = (tension: number) =>
		Math.max(...tensionPatch(quad, { pressure: 0.15, tension }).positions.map((p) => p[2]));
	expect(height(2)).toBeGreaterThan(4);
	expect(height(4)).toBeLessThan(height(2));
	const reverse: typeof quad = [quad[0], quad[3], quad[2], quad[1]];
	const downward = tensionPatch(reverse, { pressure: 0.15, tension: 2 }).positions;
	expect(Math.max(...downward.map((p) => p[2]))).toBe(4);
	expect(Math.min(...downward.map((p) => p[2]))).toBeLessThan(4);
});

test('an inclined three-grip patch is connected and has a single triangular perimeter', () => {
	const patch = tensionPatch(triangle, fabric);
	const incidence = new Map<string, number>();
	for (let a = 0; a < patch.faces.length; a += 3) {
		const face = patch.faces.slice(a, a + 3);
		expect(new Set(face).size).toBe(3);
		for (let i = 0; i < 3; i++) {
			const key = [face[i], face[(i + 1) % 3]].sort((a, b) => a - b).join('/');
			incidence.set(key, (incidence.get(key) ?? 0) + 1);
		}
	}
	const boundary = [...incidence.values()].filter((count) => count === 1);
	expect(incidence.size - patch.positions.length - patch.faces.length / 3).toBe(-1);
	expect(boundary.length).toBe(patch.edges.reduce((n, edge) => n + edge.length - 1, 0));
	expect(patch.edges.map((e) => patch.positions[e[0]])).toEqual(triangle);
});

test('zero-area rest faces and non-positive tension are rejected', () => {
	expect(() => tensionPatch([triangle[0], triangle[1], triangle[1]], fabric)).toThrow(RangeError);
	expect(() => tensionPatch(quad, { pressure: 0, tension: 0 })).toThrow(RangeError);
});
