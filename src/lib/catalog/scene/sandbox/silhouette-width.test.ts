import assert from 'node:assert/strict';
import { test } from 'node:test';
import { random } from '../../core/random';
import { forestChunk } from '../../logic/land-cover';
import { acceptanceScene } from '../../logic/sandbox';
import type { Primitive, Vec3 } from '../../logic/parametrik/types';
import { contourWidthMeters } from './contour-width';
import { distanceDrawing } from './distance-drawing';

// Every supporting edge joins two of the input vertices. Scan all such angles without a hull.
function reference(points: Vec3[]) {
	let width = Infinity;
	for (const [i, [x, y]] of points.entries())
		for (const [u, v] of points.slice(i + 1)) {
			const dx = u - x,
				dy = v - y,
				len = Math.hypot(dx, dy);
			if (!len) continue;
			const dots = points.map(([a, b]) => ((a - x) * dy - (b - y) * dx) / len);
			width = Math.min(width, Math.max(...dots) - Math.min(...dots));
		}
	return Number.isFinite(width) ? width : 0;
}
test('projected width matches exhaustive support angles across repeated points, plateaus and winding', () => {
	const draw = random(1703);
	for (let n = 0; n < 384; n++) {
		const points: Vec3[] = Array.from({ length: 3 + Math.floor(draw() * 22) }, () => [
			Math.round(draw() * 16),
			Math.round(draw() * 12),
			0
		]);
		points.push(points[0], points[0]);
		const expected = reference(points);
		for (const ring of [points, points.toReversed()]) {
			const triangles = Array.from({ length: ring.length - 2 }, (_, i) => [0, i + 1, i + 2]).flat();
			const mesh: Primitive = {
				kind: 'mesh',
				points: ring,
				triangles,
				lines: [],
				role: 'neu',
				material: 'concrete',
				token: '--paper',
				id: 'polygon'
			};
			assert(Math.abs(contourWidthMeters(mesh, Math.PI / 2) - expected) < 1e-9);
		}
	}
});
test('the seed-seven forest helix keeps its six-pixel plan outline', () => {
	const { world } = acceptanceScene();
	const tree = forestChunk(world.grid, world.state.cover, '6:2', world.seed).find(
		(p) => p.id === '103/42:tree0'
	);
	assert(tree?.kind === 'helix');
	assert(Math.abs(2 * contourWidthMeters(tree, Math.PI / 2) - 6.138449) < 1e-6);
	assert(
		!distanceDrawing([tree], {
			block: true,
			scale: 2,
			minContourPx: 6,
			elevation: Math.PI / 2
		}).unoutlined.has(tree)
	);
});
