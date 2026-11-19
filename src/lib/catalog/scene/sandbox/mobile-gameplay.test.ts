// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { expect, test } from 'bun:test';
import * as THREE from 'three/webgpu';
import { applyEdit, openingScene } from '../../logic/sandbox';
import { frameOldTown } from './opening-view';
import { patchSurface, surfaceGeometry } from './terrain-geometry';
import { createTerrainPicker } from './terrain-pick';
import { createView } from './view';

const { world } = openingScene(7);
const view = createView();

test('the portrait opening fits the town and leaves the near terrain rim below the frame', () => {
	view.resize(390, 844);
	frameOldTown(view, world);
	const rim = world.grid.cells
		.filter(({ row }) => row === 0)
		.flatMap(({ corners }) => corners.slice(0, 2).map(view.project))
		.filter(({ x }) => x > -20 && x < 410);
	expect(rim.length).toBeGreaterThan(0);
	expect(Math.min(...rim.map(({ y }) => y))).toBeGreaterThan(844);
	const north = world.grid.cells
		.filter(({ row }) => row === world.grid.rows - 1)
		.flatMap(({ corners }) => corners.slice(2).map(view.project))
		.filter(({ x }) => x >= 0 && x <= 390);
	expect(Math.max(...north.map(({ y }) => y))).toBeLessThan(0);
	const town = [...world.state.stacks.keys()]
		.flatMap((id) => world.grid.cellsById.get(id)?.corners ?? [])
		.map(view.project);
	const xs = town.map(({ x }) => x);
	expect((Math.max(...xs) - Math.min(...xs)) / 390).toBeCloseTo(0.89, 3);
});

test('chunk picking selects the same terrain cell as the rendered triangles on phone', () => {
	view.resize(390, 844);
	frameOldTown(view, world);
	const picker = createTerrainPicker();
	picker.setGrid(world.grid);
	const geometry = surfaceGeometry(world.grid);
	const material = new THREE.MeshBasicMaterial();
	const surface = new THREE.Mesh(geometry, material);
	const raycaster = new THREE.Raycaster();
	for (const y of [160, 420, 520, 675, 820]) {
		for (const x of [12, 70, 120, 192, 240, 300, 375]) {
			raycaster.setFromCamera(view.ndc(x, y), view.camera);
			const face = raycaster.intersectObject(surface)[0]?.faceIndex;
			expect(picker.pick(raycaster.ray, Infinity)?.index).toBe(
				face == null ? undefined : face >> 1
			);
		}
	}
	geometry.dispose();
	material.dispose();
});

test('panning follows a 30 × 45 pixel finger displacement and zoom keeps the anchor', () => {
	view.resize(390, 844);
	frameOldTown(view, world);
	const pointer = view.target.clone();
	const point: [number, number, number] = [pointer.x, -pointer.z, pointer.y];
	const before = view.project(point);
	view.pan(30, 45);
	const after = view.project(point);
	expect(after.x - before.x).toBeCloseTo(30, 5);
	expect(after.y - before.y).toBeCloseTo(45, 5);
	view.zoomAt(0.7, after.x, after.y);
	const zoomed = view.project(point);
	expect(zoomed.x).toBeCloseTo(after.x, 5);
	expect(zoomed.y).toBeCloseTo(after.y, 5);
});

test('updating a dug surface in place matches a full projection', () => {
	const after = applyEdit(world, { kind: 'dig', cellId: '78/38' });
	const patched = surfaceGeometry(world.grid);
	const fresh = surfaceGeometry(after.grid);
	patchSurface(patched, world.grid, after.grid);
	for (const [name, attribute] of Object.entries(fresh.attributes)) {
		const updated = patched.attributes[name].array;
		expect(Buffer.from(updated.buffer).equals(Buffer.from(attribute.array.buffer))).toBe(true);
	}
	patched.dispose();
	fresh.dispose();
});
