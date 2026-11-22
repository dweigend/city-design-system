import { expect, test } from 'bun:test';
import { levelHeight } from '../../domain/city-volume';
import { example } from './example';
import { projectCityVolume } from './index';

test('draws a continuous triangulated profile over the plan at its metric heights', () => {
	const { plan, volume, heightAt, object, drawables } = example();
	expect(object.parts.map(({ id }) => id)).toEqual(['lattice', 'profile', 'nodes']);
	const profile = drawables[1];
	expect(profile).toMatchObject({
		finish: 'glass',
		color: '--blueprint-3',
		opacity: '--alpha-hull'
	});
	const { shape } = profile;
	if (shape.kind !== 'mesh') throw new Error('Expected the indexed profile mesh');
	expect(shape.indices.length / 3).toBe(8 * plan.cells.length);
	expect(profile.strokeSegments?.length).toBeGreaterThan(0);
	for (let i = 0; i < shape.positions.length; i += 3) {
		const [x, y, z] = shape.positions.slice(i, i + 3);
		expect(z - heightAt(x, y)).toBeCloseTo(volume.profile.height(x, y), 8);
	}
});

test('batches unique lattice edges at full-height intervals above the plan', () => {
	const { heightAt, drawables } = example();
	const lattice = drawables[0];
	const strokes = lattice.strokeSegments ?? [];
	const unique = new Set<string>();
	let verticals = 0;
	for (let i = 0; i < strokes.length; i += 6) {
		const [x, y, z, u, v, w] = strokes.slice(i, i + 6);
		const key = [[x, y, z].join(','), [u, v, w].join(',')].sort().join('/');
		expect(unique.has(key)).toBe(false);
		unique.add(key);
		expect((z - heightAt(x, y)) / levelHeight).toBeCloseTo(
			Math.round((z - heightAt(x, y)) / levelHeight),
			8
		);
		if (x === u && y === v) {
			expect(Math.abs(w - z)).toBeCloseTo(levelHeight, 8);
			verticals++;
		}
	}
	expect(verticals).toBeGreaterThan(0);
});

test('keeps the profile drawable when no full lattice cells fit', () => {
	const { plan, volume, heightAt, object } = example();
	const grid = {
		columns: volume.grid.columns.map((column) => ({ ...column, levels: 0 })),
		cells: []
	};
	const { drawables } = projectCityVolume(
		{ ...volume, grid },
		plan,
		object.footprint,
		(x, y) => [x, y],
		heightAt
	);
	expect(drawables.map(({ id }) => id)).toEqual(['profile', 'nodes']);
});
