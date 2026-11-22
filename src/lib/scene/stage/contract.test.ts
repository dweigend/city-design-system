import { expect, test } from 'bun:test';
import { dotProduct, displacement } from '../../core/geometry';
import { Stage, stageExample, type Display, type View } from './index';
import { fitCamera, readView } from './camera';
import { shapeArrays } from './geometry';
import { readDisplay } from './material';
import { stageState } from './state';

test('frames the same metric bounds in iso, plan and a portrait viewport', () => {
	const { bounds } = stageExample();
	const wide = fitCamera('iso', bounds, 2);
	const narrow = fitCamera('iso', bounds, 0.4);
	const plan = fitCamera('plan', bounds, 2);
	expect(wide.center).toEqual([0, 0, 1.15]);
	expect(narrow.center).toEqual(wide.center);
	expect(narrow.halfHeight).toBeGreaterThan(wide.halfHeight);
	expect(wide.eye[0]).toBeGreaterThan(0);
	expect(wide.eye[1]).toBeLessThan(0);
	expect(wide.eye[2]).toBeGreaterThan(wide.center[2]);
	expect(plan.up).toEqual([0, 1, 0]);
	expect(displacement(plan.center, plan.eye).slice(0, 2)).toEqual([0, 0]);
	expect(plan.halfHeight).toBeGreaterThan(1.5);
	expect(dotProduct(readView('iso').eye, readView('iso').eye)).toBeCloseTo(1);
});

test('builds a rotated box, triangulates both prism windings and preserves indexed meshes', () => {
	const box = shapeArrays({
		kind: 'box',
		center: [2, 3, 1],
		size: [4, 2, 2],
		rotation: Math.PI / 2
	});
	expect(box.positions).toHaveLength(24);
	expect(box.positions[0]).toBeCloseTo(3);
	expect(box.positions[1]).toBeCloseTo(1);
	expect(box.indices).toHaveLength(36);
	const triangle = [
		[0, 0],
		[2, 0],
		[0, 1]
	] as const;
	const prism = { kind: 'prism', polygon: triangle, base: 2, top: 3 } as const;
	expect(shapeArrays(prism)).toEqual(shapeArrays({ ...prism, polygon: [...triangle].reverse() }));
	expect(shapeArrays({ ...prism, polygon: [...triangle, triangle[0]] })).toEqual(
		shapeArrays(prism)
	);
	expect(shapeArrays(prism).indices).toHaveLength(24);
	expect(shapeArrays({ ...prism, top: prism.base }).indices).toHaveLength(3);

	const { shape } = stageExample().drawables[2];
	if (shape.kind !== 'mesh') throw new Error('Expected a mesh fixture');
	expect(shapeArrays(shape)).toEqual({ positions: shape.positions, indices: shape.indices });
});

test('applies one translucent paper treatment to every fill and preserves line-only parts', () => {
	const normal = readDisplay('normal');
	const transparency = readDisplay('transparency');
	expect(normal('matte').opacity).toBe(1);
	expect(normal('gloss').shade).toBeGreaterThan(normal('matte').shade);
	expect(normal('glass').opacity).toBeLessThan(1);
	expect(normal('line').opacity).toBe(0);
	expect(transparency('line').opacity).toBe(0);
	expect(transparency('glass')).toEqual(transparency('matte'));
	expect(transparency('gloss')).toEqual(transparency('matte'));
	expect(transparency('matte').paper).toBe(true);
});

test('rejects unknown view and display IDs, including inherited names', () => {
	const state = stageState(true, 'Test adapter');
	expect(() => state.setView('terrain' as View)).toThrow(RangeError);
	expect(() => readView('toString' as View)).toThrow(RangeError);
	expect(() => state.setDisplay('wireframe' as Display)).toThrow(RangeError);
});

test('replaces the drawable count and counts builds only on show', () => {
	const state = stageState(true, 'Test adapter');
	const { drawables } = stageExample();
	state.show(drawables);
	const before = state.read();
	state.setView('plan');
	state.setDisplay('transparency');
	expect(state.read()).toEqual({ ...before, view: 'plan', display: 'transparency' });
	state.show(drawables.slice(0, 1));
	expect(state.read()).toMatchObject({ drawableCount: 1, geometryBuildCount: 4 });
	state.show([]);
	expect(state.read()).toMatchObject({ drawableCount: 0, geometryBuildCount: 4 });
	expect(before).toMatchObject({ drawableCount: 3, geometryBuildCount: 3, view: 'iso' });
});

test('reports a missing WebGPU adapter through the public entry', async () => {
	await expect(Stage.create({ canvas: {} as HTMLCanvasElement })).rejects.toThrow(
		/WebGPU stage initialisation failed/
	);
});
