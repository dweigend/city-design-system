import assert from 'node:assert/strict';
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

test('the playable town centres an occupied parcel between the HUD edges', () => {
	view.resize(390, 844);
	expect(frameOldTown(view, world, openingArea)).toBe(true);
	const centerY = (openingArea.top + openingArea.bottom) / 2;
	const cell = [...world.state.stacks.keys()]
		.map((id) => {
			const parcel = world.grid.cellsById.get(id);
			assert(parcel);
			return parcel;
		})
		.find(({ center }) => {
			const { x, y } = view.project(center);
			return Math.hypot(x - 195, y - centerY) < 0.001;
		});
	if (!cell) throw new Error('Missing sample plot');
	const { x, y } = view.project(cell.center);
	expect(x).toBeCloseTo(195);
	expect(y).toBeCloseTo(centerY);
});

type ScreenPoint = ReturnType<typeof view.project>;

function visibleEdge(a: ScreenPoint, b: ScreenPoint) {
	let start = 0;
	let end = 1;
	for (const [from, to, low, high] of [
		[a.x, b.x, 0, 390],
		[a.y, b.y, openingArea.top, openingArea.bottom]
	]) {
		if (from === to) {
			if (from < low || from > high) return;
			continue;
		}
		const first = (low - from) / (to - from);
		const last = (high - from) / (to - from);
		start = Math.max(start, Math.min(first, last));
		end = Math.min(end, Math.max(first, last));
	}
	if (start > end) return;
	const pointAt = (t: number) => new THREE.Vector2(a.x, a.y).lerp(new THREE.Vector2(b.x, b.y), t);
	return new THREE.Line3(
		new THREE.Vector3(...pointAt(start).toArray(), 0),
		new THREE.Vector3(...pointAt(end).toArray(), 0)
	);
}

test('the tighter portrait opening crops the terrain rim outside the HUD opening', () => {
	view.resize(390, 844);
	frameOldTown(view, world, openingArea);
	const boundary = world.grid.cells.flatMap(({ corners, neighbors }) =>
		neighbors.flatMap((neighbor, i) =>
			neighbor === null ? [[corners[i], corners[(i + 1) % 4]]] : []
		)
	);
	const visible = () =>
		boundary.filter(([a, b]) => visibleEdge(view.project(a), view.project(b))).length;
	expect(visible()).toBe(0);
	view.zoomAt(1.4, 195, 411);
	expect(visible()).toBeGreaterThan(0);
});

function visibleDesktopParcels(camera: ReturnType<typeof createView>) {
	return [...world.state.stacks.keys()].filter((id) => {
		const cell = world.grid.cellsById.get(id);
		assert(cell);
		const { x, y } = camera.project(cell.center);
		return x >= 0 && x <= 1440 && y >= 0 && y <= 900;
	}).length;
}

test('the desktop opening includes the central district and crops outlying parcels', () => {
	view.resize(1440, 900);
	expect(frameTownSilhouette(view, world)).toBe(true);
	const visible = visibleDesktopParcels(view);
	expect(visible).toBeGreaterThanOrEqual(Math.ceil((world.state.stacks.size * 2) / 3));
	expect(visible).toBeLessThan(world.state.stacks.size);
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

test('switching the desktop opening to plan keeps the majority of parcels visible', () => {
	const desktop = createView();
	desktop.resize(1440, 900);
	frameTownSilhouette(desktop, world);
	desktop.setPlan(true);
	expect(visibleDesktopParcels(desktop)).toBeGreaterThan(world.state.stacks.size / 2);
});

test('plan rotation preserves a panned and zoomed district across both projections', () => {
	const district = createView();
	district.resize(1440, 900);
	frameTownSilhouette(district, world);
	district.pan(165, -80);
	district.zoomAt(0.3, 500, 350);
	const { x, y, z } = district.target;
	const point: [number, number, number] = [x, -z, y];
	const scale = district.metersPerPixel();
	for (const plan of [true, false]) {
		district.setPlan(plan);
		expect(district.project(point).x).toBeCloseTo(720);
		expect(district.project(point).y).toBeCloseTo(450);
		expect(district.metersPerPixel()).toBe(scale);
	}
});

test('the portrait plan and return preserve the opening parcel between the HUD edges', () => {
	const phone = createView();
	phone.resize(390, 844);
	frameOldTown(phone, world, openingArea);
	const focusY = (openingArea.top + openingArea.bottom) / 2;
	const anchor = [...world.state.stacks.keys()]
		.map((id) => world.grid.cellsById.get(id)?.center)
		.find(
			(center) =>
				center &&
				Math.abs(phone.project(center).y - focusY) < 0.001 &&
				Math.abs(phone.project(center).x - 195) < 0.001
		);
	if (!anchor) throw new Error('Missing opening focus');
	const elevation = phone.elevation();
	for (const plan of [true, false]) {
		phone.setPlan(plan);
		expect(phone.project(anchor).x).toBeCloseTo(195);
		expect(phone.project(anchor).y).toBeCloseTo(focusY);
	}
	expect(phone.elevation()).toBe(elevation);
});
