import { expect, test } from 'bun:test';
import { TerrainGrid } from '../../domain/terrain-grid';
import { Valley } from '../../domain/valley';
import { reachFrame } from './frame';
import { sectionCuts } from './sections';
import { projectValley, projectValleyWindow, valleyTriangleBudget } from './index';

test('frames the regional reach as a cut block within the triangle budget', () => {
	const valley = Valley.create({ seed: 1201 });
	const { object, heightScale, drawables, triangleCount } = projectValley(valley);
	expect(object.footprint.width).toBeGreaterThanOrEqual(8000);
	expect(object.footprint.width).toBeLessThan(8200);
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

test('keeps slender tributaries legible with a blue minimum-width stroke', () => {
	const valley = Valley.create({ seed: 424242, parameters: { relief: 1 } });
	const { drawables } = projectValley(valley);
	const water = drawables.find(({ id }) => id === 'river');
	expect(water?.stroke).toEqual({ color: '--river-water', width: 2.2, opacity: 1 });
	expect(water?.strokeSegments?.length).toBeGreaterThan(0);
	expect((water?.strokeSegments?.length ?? 0) % 6).toBe(0);
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

function waterArea(shape: { positions: readonly number[]; indices: readonly number[] }) {
	let area = 0;
	const p = shape.positions;
	for (let i = 0; i < shape.indices.length; i += 3) {
		const [a, b, c] = shape.indices.slice(i, i + 3).map((index) => index * 3);
		area += ((p[b] - p[a]) * (p[c + 1] - p[a + 1]) - (p[c] - p[a]) * (p[b + 1] - p[a + 1])) / 2;
	}
	return area;
}

function wetIntervals(
	valley: Valley,
	toWorld: (x: number, y: number) => [number, number],
	x: number
) {
	let count = 0;
	let wet = false;
	for (let y = -3990; y <= 3990; y += 20) {
		const now = valley.sampleGround(...toWorld(x, y)).bank < 0;
		if (now && !wet) count++;
		wet = now;
	}
	return count;
}

test('covers every wet area of a reversed or crosswise window with upward water', () => {
	const valley = Valley.create({ seed: 1201, parameters: { relief: 1, runoff: 1.5 } });
	const bearing = valley.course.bearing;
	const windows = [bearing + Math.PI, bearing + Math.PI / 2].map((angle) => ({
		origin: [0, 0] as const,
		bearing: angle,
		length: 2400,
		width: 8000
	}));
	for (const window of windows) {
		const { object } = projectValleyWindow(valley, window, 2);
		const water = object.parts.find(({ slot }) => slot === 'water')?.shape;
		if (water?.kind !== 'mesh') throw new Error('Expected a water mesh');
		const [fx, fy] = [Math.cos(window.bearing), Math.sin(window.bearing)];
		const toWorld = (x: number, y: number): [number, number] => [x * fx - y * fy, x * fy + y * fx];
		let wet = 0;
		let samples = 0;
		for (let x = -1190; x <= 1190; x += 20) {
			for (let y = -3990; y <= 3990; y += 20) {
				samples++;
				if (valley.sampleGround(...toWorld(x, y)).bank < 0) wet++;
			}
		}
		const expected = (wet / samples) * window.length * window.width;
		expect(waterArea(water)).toBeGreaterThan(0.8 * expected);
		expect(waterArea(water)).toBeLessThan(1.2 * expected);
	}
	const crosswise = windows[1];
	const [fx, fy] = [Math.cos(crosswise.bearing), Math.sin(crosswise.bearing)];
	const rows = [-900, -450, 0, 450, 900].map((x) =>
		wetIntervals(valley, (u, v) => [u * fx - v * fy, u * fy + v * fx], x)
	);
	expect(Math.max(...rows)).toBeGreaterThan(1);
});

test('inserts both banks and bed samples for three streams between raster rows', () => {
	const cuts = sectionCuts(
		[-180, 7, 99].map((y) => [
			[4, y, 2],
			[20, y, 1],
			[20, y + 4.8, 1],
			[4, y + 4.8, 2]
		]),
		12
	);
	expect(cuts.filter(({ bank }) => bank)).toHaveLength(6);
	expect(cuts.filter(({ bank }) => !bank).map(({ across }) => Math.round(across))).toEqual([
		-178, 9, 101
	]);
	expect(cuts.every(({ water }) => water === 1.5)).toBe(true);
});

test('keeps the regional display corners and their slope probes inside the solve', () => {
	for (const seed of [1201, 1301, 1409, 42, 314, 424242]) {
		for (const sinuosity of [1.04, 1.15, 1.28]) {
			const frame = reachFrame(Valley.create({ seed, parameters: { sinuosity, relief: 1 } }), 4000);
			for (const x of [-frame.length / 2, frame.length / 2]) {
				for (const y of [-2000, 2000]) {
					const [u, v] = frame.toWorld(x, y);
					expect(Math.max(Math.abs(u), Math.abs(v)) + 2.5).toBeLessThanOrEqual(6000);
				}
			}
		}
	}
});

test('covers a sampled channel point at a curved reach join', () => {
	const valley = Valley.create({ seed: 1201, parameters: { relief: 1, runoff: 1.5 } });
	const world = [-1055, 1885] as const;
	expect(valley.sampleGround(...world).bank).toBeLessThan(0);
	const window = { origin: [0, 0], bearing: 0, length: 4000, width: 4000 } as const;
	const { drawables, toLocal } = projectValleyWindow(valley, window, 1);
	const mesh = drawables.find(({ id }) => id === 'river')?.shape;
	expect(mesh?.kind).toBe('mesh');
	if (mesh?.kind !== 'mesh') throw new Error('Expected water mesh');
	const [x, y] = toLocal(...world);
	const { positions, indices } = mesh;
	function side(a: number, b: number) {
		const [u, v] = positions.slice(a * 3, a * 3 + 2);
		const [p, q] = positions.slice(b * 3, b * 3 + 2);
		return (p - u) * (y - v) - (q - v) * (x - u);
	}
	let covered = false;
	for (let i = 0; i < indices.length; i += 3) {
		const [a, b, c] = indices.slice(i, i + 3);
		if (side(a, b) >= 0 && side(b, c) >= 0 && side(c, a) >= 0) {
			covered = true;
			break;
		}
	}
	expect(covered).toBe(true);
});
