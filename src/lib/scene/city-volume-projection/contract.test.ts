import { expect, test } from 'bun:test';
import { levelHeight } from '../../domain/city-volume';
import { example } from './example';
import { projectCityLattice } from './index';

test('draws the independently sampled surface and elevation contours at metric heights', () => {
	const { profile, heightAt, surface } = example();
	const [drawable] = surface.drawables;
	const { shape } = drawable;
	expect(drawable).toMatchObject({
		finish: 'glass',
		color: '--blueprint-3',
		opacity: '--alpha-hull'
	});
	if (shape.kind !== 'mesh') throw new Error('Expected the indexed profile mesh');
	expect(shape.indices.length / 3).toBeGreaterThan(4000);
	expect(drawable.strokeSegments?.length).toBeGreaterThan(0);
	for (let i = 0; i < shape.positions.length; i += 3) {
		const [x, y, z] = shape.positions.slice(i, i + 3);
		expect(z - heightAt(x, y)).toBeCloseTo(profile.height(x, y), 8);
	}
	for (let i = 0; i < shape.indices.length; i += 3) {
		const [a, b, c] = shape.indices.slice(i, i + 3);
		for (const [u, v] of [
			[a, b],
			[b, c],
			[c, a]
		]) {
			const x = shape.positions[3 * u] - shape.positions[3 * v];
			const y = shape.positions[3 * u + 1] - shape.positions[3 * v + 1];
			expect(Math.hypot(x, y)).toBeLessThan(8);
		}
	}
});

test('projects one octahedral glyph per joint and one segment per unique member', () => {
	const { heightAt, lattice, members } = example();
	const [drawable] = members.drawables;
	const { shape } = drawable;
	if (shape.kind !== 'mesh') throw new Error('Expected a mesh of lattice joints');
	expect(shape.indices.length).toBe(24 * lattice.nodes.length);
	const strokes = drawable.strokeSegments ?? [];
	expect(strokes.length).toBe(6 * lattice.edges.length);
	const unique = new Set<string>();
	let verticals = 0;
	for (let i = 0; i < strokes.length; i += 6) {
		const [x, y, z, u, v, w] = strokes.slice(i, i + 6);
		const key = [[x, y, z].join(','), [u, v, w].join(',')].sort().join('/');
		expect(unique.has(key)).toBe(false);
		unique.add(key);
		const level = (z - heightAt(x, y)) / levelHeight;
		expect(level).toBeCloseTo(Math.round(level), 8);
		if (x === u && y === v) {
			expect(Math.abs(w - z)).toBeCloseTo(levelHeight, 8);
			verticals++;
		}
	}
	expect(verticals).toBeGreaterThan(0);
});

test('omits the lattice drawable when no full levels fit', () => {
	const { frame } = example();
	expect(projectCityLattice({ cells: [], nodes: [], edges: [] }, frame).drawables).toEqual([]);
});
