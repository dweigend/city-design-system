import { expect, test } from 'bun:test';
import { dotProduct, displacement } from '../../core/geometry';
import { Stage, stageExample, type Display, type View } from './index';
import { fitCamera, readView } from './camera';
import { hasSameGeometry } from './content';
import { edgeGeometry } from './edges';
import { shapeArrays } from './geometry';
import { shadowPolygon } from './ground';
import { readDisplay } from './material';
import { stageState } from './state';

test('frames the same metric bounds in iso, plan and a portrait viewport', () => {
	const { bounds } = stageExample();
	const wide = fitCamera('iso', bounds, 2);
	const narrow = fitCamera('iso', bounds, 0.4);
	const plan = fitCamera('plan', bounds, 2);
	expect(wide.center).toEqual([0, 0, 2.3]);
	expect(narrow.center).toEqual(wide.center);
	expect(narrow.halfHeight).toBeGreaterThan(wide.halfHeight);
	expect(wide.eye[0]).toBeGreaterThan(0);
	expect(wide.eye[1]).toBeLessThan(0);
	expect(wide.eye[2]).toBeGreaterThan(wide.center[2]);
	expect(plan.up).toEqual([0, 1, 0]);
	expect(displacement(plan.center, plan.eye).slice(0, 2)).toEqual([0, 0]);
	expect(plan.halfHeight).toBeGreaterThan(1.5);
	for (const [x, y] of shadowPolygon(bounds)) {
		expect(Math.abs(x - plan.center[0])).toBeLessThan(plan.halfWidth);
		expect(Math.abs(y - plan.center[1])).toBeLessThan(plan.halfHeight);
	}
	expect(dotProduct(readView('iso').eye, readView('iso').eye)).toBeCloseTo(1);
});

test('fits every corner of kilometer-scale bounds in both landscape views', () => {
	const bounds = { min: [-1000, -1000, -3], max: [1000, 1000, 20] } as const;
	for (const view of ['iso', 'plan'] as const) {
		const camera = fitCamera(view, bounds, 16 / 9, true, {
			bearing: 0.384,
			elevation: 0.75,
			fill: 0.96
		});
		const depth = Math.hypot(...displacement(camera.center, camera.eye));
		expect(camera.halfWidth).toBeGreaterThan(1000);
		expect(camera.halfHeight).toBeGreaterThan(view === 'plan' ? 1000 : 820);
		expect(camera.near).toBeGreaterThan(0);
		expect(camera.near).toBeLessThan(depth);
		expect(camera.far).toBeGreaterThan(depth);
	}
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
	const hull = 0.3;
	expect(normal('matte', hull).opacity).toBe(1);
	expect(normal('glass', hull).opacity).toBeLessThan(1);
	expect(normal('line', hull).opacity).toBe(0);
	expect(transparency('line', hull).opacity).toBe(0);
	expect(transparency('glass', hull)).toEqual(transparency('matte', hull));
	expect(transparency('gloss', hull)).toEqual(transparency('matte', hull));
	expect(transparency('matte', hull)).toEqual({ opacity: hull, paper: true });
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
	expect(state.read()).toMatchObject({ drawableCount: 1, geometryBuildCount: 7 });
	state.show([]);
	expect(state.read()).toMatchObject({ drawableCount: 0, geometryBuildCount: 7 });
	expect(before).toMatchObject({
		drawableCount: 6,
		geometryBuildCount: 6,
		geometryBatchCount: 1,
		view: 'iso'
	});
	expect(state.read().geometryBatchCount).toBe(3);
});

test('reports a missing WebGPU adapter through the public entry', async () => {
	await expect(Stage.create({ canvas: {} as HTMLCanvasElement })).rejects.toThrow(
		/WebGPU stage initialisation failed/
	);
});

test('retains geometry for the same ordered IDs and shape references', () => {
	const { drawables, newDrawables } = stageExample();
	const parts = drawables.map((drawable) => ({ drawable }));
	expect(hasSameGeometry(parts, newDrawables)).toBe(true);
	expect(hasSameGeometry(parts, [...newDrawables].reverse())).toBe(false);
	expect(hasSameGeometry(parts, newDrawables.slice(1))).toBe(false);
	expect(hasSameGeometry(parts, structuredClone(newDrawables))).toBe(false);
});

test('keeps the gable ridge and drops the coplanar roof triangle seams', () => {
	const { positions, indices } = shapeArrays(stageExample().drawables[2].shape);
	const edges = edgeGeometry(positions, indices);
	expect(edges.instanceCount).toBe(9);
	expect(edges.attributes.edgeFront.count).toBe(9);
	edges.dispose();
});

test('casts the bounds outline 60 percent of its height away from the sun', () => {
	const { bounds } = stageExample();
	const projected = shadowPolygon(bounds);
	const corner = projected[3];
	const offset = Math.hypot(corner[0] - bounds.max[0], corner[1] - bounds.max[1]);
	expect(offset).toBeCloseTo(2.76);
	expect(projected.every((point) => point[2] === projected[0][2])).toBe(true);
});
