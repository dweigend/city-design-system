import { expect, test } from 'bun:test';
import * as THREE from 'three/webgpu';
import { applyEdit, openingScene, EMPTY_STATE, withState } from '../../logic/sandbox';
import { frameOldTown, frameTownSilhouette } from './opening-view';
import { patchSurface, surfaceGeometry } from './terrain-geometry';
import { seatedTargets } from './roof-pick';
import { createTerrainPicker } from './terrain-pick';
import { createView } from './view';
import { createTerrainMesh } from './terrain-mesh';
import { KEY, projectChanges } from './projection';
import type { Primitive } from '../../logic/parametrik/types';

const { world } = openingScene(7);
const view = createView();
const openingArea = { top: 142, bottom: 680 };

test('the playable town opens at 50 pixels per anchor parcel between the HUD edges', () => {
	view.resize(390, 844);
	expect(frameOldTown(view, world, openingArea)).toBe(true);
	const cell = world.grid.cellsById.get('86/43');
	if (!cell) throw new Error('Missing sample plot');
	const xs = cell.corners.map((corner) => view.project(corner).x);
	expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(50);
	const { x, y } = view.project(cell.center);
	expect(x).toBeCloseTo(195);
	expect(y).toBeCloseTo((openingArea.top + openingArea.bottom) / 2);
});

test('the portrait opening keeps the terrain rim outside the playable area', () => {
	view.resize(390, 844);
	frameOldTown(view, world, openingArea);
	const rim = world.grid.cells.filter(({ neighbors }) => neighbors.includes(null));
	for (const { corners } of rim) {
		for (const { x, y } of corners.map(view.project))
			expect(x < 0 || x > 390 || y < openingArea.top || y > openingArea.bottom).toBe(true);
	}
});

test('the desktop opening retains half the width for the old town', () => {
	view.resize(1440, 900);
	expect(frameTownSilhouette(view, world)).toBe(true);
	const town = [...world.state.stacks.keys()]
		.flatMap((id) => world.grid.cellsById.get(id)?.corners ?? [])
		.map(view.project);
	const xs = town.map(({ x }) => x);
	expect((Math.max(...xs) - Math.min(...xs)) / 1440).toBeCloseTo(0.5, 3);
});

test('chunk picking selects the same terrain cell as the rendered triangles on phone', () => {
	view.resize(390, 844);
	frameOldTown(view, world, openingArea);
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
	frameOldTown(view, world, openingArea);
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

test('picking a house uses its seated geometry through the whole drop', () => {
	const geometry = new THREE.BoxGeometry(3, 3, 3);
	const material = new THREE.MeshBasicMaterial();
	const house = new THREE.Mesh(geometry, material);
	const dropping = new THREE.Group().add(house);
	const proxies = seatedTargets([house]);
	const ray = new THREE.Raycaster(new THREE.Vector3(-10, 1, -1), new THREE.Vector3(1, 0, 0));
	dropping.position.y = 9;
	dropping.updateMatrixWorld(true);
	expect(ray.intersectObject(house)).toHaveLength(0);
	const during = ray.intersectObjects(proxies);
	expect(during[0]?.distance).toBe(8.5);
	dropping.position.y = 0;
	dropping.updateMatrixWorld(true);
	expect(ray.intersectObject(house)[0]?.distance).toBe(during[0]?.distance);
	expect(ray.intersectObjects(proxies)[0]?.distance).toBe(during[0]?.distance);
	geometry.dispose();
	material.dispose();
});

test('rebuilding the affected house groups after a dig equals drawing the whole town', () => {
	const dug = applyEdit(world, { kind: 'dig', cellId: '76/41' });
	const terrain = createTerrainMesh(world.grid);
	const previous = { ...world, state: EMPTY_STATE, lines: [] };
	const live = new Map<string, Primitive[]>();
	const full = new Map<string, Primitive[]>();
	const puts = (batches: Map<string, Primitive[]>) => ({
		set(key: string, parts: Primitive[]) {
			if (parts.length) batches.set(key, parts);
			else batches.delete(key);
		}
	});
	const houseBatches = (batches: Map<string, Primitive[]>) =>
		[...batches]
			.filter(([key]) => key.startsWith(KEY.house))
			.sort(([a], [b]) => a.localeCompare(b));
	try {
		projectChanges({ terrain, structures: puts(live) }, previous, world, 'all', false);
		const untouched = new Map(live);
		projectChanges({ terrain, structures: puts(live) }, world, dug, 'all', false);
		const independentlyDerived = withState(openingScene(7).world, dug.state);
		projectChanges(
			{ terrain, structures: puts(full) },
			independentlyDerived,
			independentlyDerived,
			'all',
			true
		);
		expect(houseBatches(live)).toEqual(houseBatches(full));
		expect(
			houseBatches(live).filter(([key, parts]) => untouched.get(key) === parts).length
		).toBeGreaterThan(0);
	} finally {
		terrain.dispose();
	}
});
