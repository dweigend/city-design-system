import { expect, test } from 'bun:test';
import { TerrainGrid } from '../../domain/terrain-grid';
import { Valley } from '../../domain/valley';
import { projectValley, projectValleyWindow, valleyTriangleBudget } from './index';

test('frames the regional reach as a cut block within the triangle budget', () => {
	const valley = Valley.create({ seed: 1201 });
	const { object, heightScale, drawables, triangleCount } = projectValley(valley);
	expect(object.footprint.width).toBeCloseTo(8079, 0);
	expect(object.footprint.depth).toBe(4000);
	expect(heightScale).toBe(14);
	expect(object.slots).toEqual(['ground', 'earth', 'water', 'water-section']);
	expect(drawables.map(({ finish }) => finish)).toEqual(['terrain', 'matte', 'matte', 'matte']);
	expect(triangleCount).toBeLessThanOrEqual(valleyTriangleBudget);
	expect(drawables[0].shape).toBe(object.parts[0].shape);
});

test('applies one scale to bed, water and cut sides, keeping XY fixed', () => {
	const valley = Valley.create({ seed: 1201 });
	const natural = projectValley(valley, 1);
	const exaggerated = projectValley(valley, 8);
	for (const [index, { shape }] of natural.object.parts.entries()) {
		const raised = exaggerated.object.parts[index].shape;
		if (shape.kind !== 'mesh' || raised.kind !== 'mesh') throw new Error('Expected mesh');
		expect(raised.indices).toEqual(shape.indices);
		for (const [component, value] of shape.positions.entries()) {
			expect(raised.positions[component]).toBeCloseTo(value * (component % 3 === 2 ? 8 : 1), 9);
		}
	}
	expect(() => projectValley(valley, 0)).toThrow(RangeError);
});

test('returns the terrain draping adapter and renders terrain for an empty plan', () => {
	const valley = Valley.create({ seed: 1201 });
	const window = { origin: [0, 0], bearing: 0, length: 600, width: 400 } as const;
	const terrain = projectValleyWindow(valley, window, 1);
	const grid = TerrainGrid.create({
		seed: 1201,
		site: window,
		variant: 'square',
		heightAt: () => 0,
		parameters: { cellSize: 60 }
	});
	expect(terrain.projectPlan(grid).drawables).toHaveLength(1);
	expect(terrain.projectPlan(TerrainGrid.select(grid, [])).drawables).toEqual([]);
	expect(terrain.drawables.length).toBeGreaterThan(0);
});
