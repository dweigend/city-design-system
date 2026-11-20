import { expect, test } from 'bun:test';
import { shellSystems } from '../../src/lib/catalog/data/house-shells';
import { buildObject } from '../../src/lib/catalog/logic/assets';
import type { MeshForm, Vec3 } from '../../src/lib/catalog/logic/parametrik/types';

// Intersect the actual triangles with a level sightline. Merge intervals so overlapping
// rods cannot inflate facade coverage. The registry bay is three metres wide and nine tall.
function sectionInterval(vertices: Vec3[], z: number) {
	const hits = vertices.flatMap(([, y, h], i) => {
		const [, b, k] = vertices[(i + 1) % 3];
		return h > z === k > z ? [] : [y + ((b - y) * (z - h)) / (k - h)];
	});
	return hits.length ? [[Math.max(-1.5, Math.min(...hits)), Math.min(1.5, Math.max(...hits))]] : [];
}
function coverage(mesh: MeshForm, z: number) {
	const intervals: number[][] = [];
	for (let i = 0; i < mesh.triangles.length; i += 3) {
		const face = mesh.triangles.slice(i, i + 3).map((j) => mesh.points[j]);
		intervals.push(...sectionInterval(face, z));
	}
	let length = 0,
		last = -1.5;
	for (const [a, b] of intervals.sort((a, b) => a[0] - b[0])) {
		length += Math.max(0, b - Math.max(last, a));
		last = Math.max(last, b);
	}
	return length / 3;
}
for (const system of shellSystems) {
	test(system + ' carries a cut wall through the lower, middle and upper elevation', () => {
		const mesh = buildObject('full-height-shell', system, 7).parts[0];
		if (mesh.kind !== 'mesh') throw Error('Missing envelope');
		const sections = Array.from({ length: 36 }, (_, i) => coverage(mesh, (i + 0.5) / 4));
		for (const start of [0, 12, 24]) {
			const third = sections.slice(start, start + 12);
			expect(third.reduce((sum, n) => sum + n, 0) / third.length).toBeGreaterThan(0.5);
		}
		expect(Math.min(...sections)).toBeLessThan(0.97);
	});
}
