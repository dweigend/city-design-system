import { expect, test } from 'bun:test';
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
	const valley = Valley.create({ seed: 1201, parameters: { relief: 0.5, lake: 2 } });
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
		expect(waterArea(water)).toBeGreaterThan(0.95 * expected);
		expect(waterArea(water)).toBeLessThan(1.05 * expected);
	}
	const crosswise = windows[1];
	const [fx, fy] = [Math.cos(crosswise.bearing), Math.sin(crosswise.bearing)];
	const rows = [-900, -450, 0, 450, 900].map((x) =>
		wetIntervals(valley, (u, v) => [u * fx - v * fy, u * fy + v * fx], x)
	);
	expect(Math.max(...rows)).toBeGreaterThan(1);
});
