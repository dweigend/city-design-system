import { createCanvasHover } from './canvas-hover';
import { checkHeldErase } from './fixtures/held-erase';
import legacy from './fixtures/seed-7-pick-lots.json';
import { reviewWorld } from './fixtures/review-world';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import init from 'manifold-3d';
import * as THREE from 'three/webgpu';
import { createRoofBuilder } from '../../logic/building-envelope';
import { hash } from '../../logic/hash-random';
import { render } from './fixtures/pick-reference';
import { applyEdit, createWorld, type World } from '../../logic/sandbox';
import { cellAtPoint } from '../../logic/terrain-grid';
import { createCellPicker } from './house-picker';
import { createView } from './view';
import { surfaceGeometry } from './terrain-geometry';

// Isolate the Svelte theme double from other Bun tests.
if (process.env.HOUSE_RAY_PROBE === '1') await compareRays();
else
	test(
		'brush rays follow visible stock across views and a roof swap preserves a held erase',
		{ timeout: 60000 },
		() => {
			const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
				env: { ...process.env, HOUSE_RAY_PROBE: '1' },
				encoding: 'utf8'
			});
			assert.equal(run.status, 0, run.stderr);
		}
	);

function setup(world: World) {
	const view = createView();
	view.resize(1200, 800);
	const ground = new THREE.Mesh(surfaceGeometry(world.grid), new THREE.MeshBasicMaterial());
	const bounds = new THREE.Box3().setFromObject(ground);
	const pick = createCellPicker(view);
	const select = (x: number, y: number, solids: THREE.Object3D[]) => pick(x, y, world.grid, solids);
	return { ground, bounds, view, select };
}

function checkReported(world: World, scene: ReturnType<typeof setup>, solids: THREE.Object3D[]) {
	const { view, bounds, select } = scene;
	view.frameBox(bounds, 1.1);
	const id = (x: number, y: number) => world.grid.cells[select(x, y, solids) ?? -1]?.id;
	const open = id(560, 443);
	view.zoomAt(0.11, 600.6063, 438.9481);
	const zoom = id(780, 250);
	assert.equal(open, '79/38');
	const removed = applyEdit(world, { kind: 'clear', cellId: open });
	assert.equal(removed.state.stacks.has(open), false);
	assert.equal(removed.state.stacks.get('78/39'), world.state.stacks.get('78/39'));
	for (const [dx, dy] of [
		[0, 0],
		[3, 0],
		[-3, 0],
		[0, 3],
		[0, -3]
	]) {
		assert.equal(select(780 + dx, 250 + dy, solids), select(780 + dx, 250 + dy, []));
	}
	assert.equal(zoom, '81/58');
	const erased = applyEdit(world, { kind: 'clear', cellId: zoom });
	assert.equal(erased.state.stacks.get('83/55'), world.state.stacks.get('83/55'));
}

function checkView(
	world: World,
	scene: ReturnType<typeof setup>,
	town: Awaited<ReturnType<typeof render>>,
	plan: boolean,
	zoom: number
) {
	const { view, ground, bounds, select } = scene;
	view.setPlan(plan);
	view.frameBox(bounds, 1.1);
	view.zoomAt(zoom, 600.6063, 438.9481);
	const ray = new THREE.Raycaster();
	ray.params.Line.threshold = view.metersPerPixel() / 2;
	const visible = [ground, ...town.visible];
	function owner(h: THREE.Intersection) {
		return h.object.userData.cellId
			? world.grid.cellsById.get(h.object.userData.cellId)?.index
			: cellAtPoint(world.grid, h.point.x, -h.point.z)?.index;
	}
	let free = 0,
		occupied = 0,
		roofs = 0;
	for (let i = 0; i < 180; i++) {
		const projected = town.targets[Math.floor(hash(7, i, 0) * town.targets.length)]
			.clone()
			.project(view.camera);
		const x = (projected.x + 1) * 600 + ((hash(7, i, 1) - 0.5) * 22) / zoom;
		const y = (1 - projected.y) * 400 + ((hash(7, i, 2) - 0.5) * 22) / zoom;
		if (!insideViewport(x, y)) continue;
		ray.setFromCamera(view.ndc(x, y), view.camera);
		const hit = ray.intersectObjects(visible, false)[0];
		if (!hit) continue;
		const actual = select(x, y, town.solids);
		if (hit.object === ground) {
			assert.equal(actual, (hit.faceIndex ?? -2) >> 1);
			free++;
			continue;
		}
		const expected = owner(hit);

		if (expected !== actual) checkEdge(x, y, expected, actual);
		occupied++;
		if (hit.object.userData.cellId) roofs++;
	}
	assert.ok(
		[free, occupied, roofs].every((count) => count > 0),
		String([plan, zoom, free, occupied, roofs])
	);
	function checkEdge(
		x: number,
		y: number,
		expected: number | undefined,
		actual: number | undefined
	) {
		const near = Array.from({ length: 16 }, (_, k) => (k * Math.PI) / 8);
		const onEdge = near.some((a) => {
			ray.setFromCamera(view.ndc(x + 2 * Math.cos(a), y + 2 * Math.sin(a)), view.camera);
			const neighbor = ray.intersectObjects(visible, false)[0];
			return !neighbor || neighbor.object === ground || owner(neighbor) !== expected;
		});
		assert.ok(onEdge, JSON.stringify({ plan, zoom, x, y, expected, actual }));
	}
}

function insideViewport(x: number, y: number) {
	return !(x < 0 || x >= 1200 || y < 0 || y >= 800);
}

async function compareRays() {
	const { mock } = await import('bun:test');
	mock.module('../themeBinding', () => ({ bindSceneTheme: () => {}, resolveTokens: () => ({}) }));
	const kernel = await init();
	kernel.setup();
	const seed = createWorld(7);
	const roofBuilder = createRoofBuilder(kernel, (_id, error) => {
		throw error;
	});
	const base = reviewWorld(seed);
	const regression = setup(base);
	const [[xmin, xmax], [ymin, ymax], [zmin, zmax]] = legacy.bounds;
	regression.bounds.set(new THREE.Vector3(xmin, zmin, -ymax), new THREE.Vector3(xmax, zmax, -ymin));
	const scene = setup(seed);
	for (const state of [base, { ...base, roofBuilder }]) {
		const town = await render(state, true);
		town.move(0);
		checkReported(state, regression, town.solids);
		town.move(1000);
		checkReported(state, regression, town.solids);
		town.dispose();
	}
	regression.ground.geometry.dispose();
	regression.ground.material.dispose();
	const position = { x: 321, y: 485 };
	const targets = new Map<World, THREE.Object3D[]>();
	let displayed: THREE.Object3D[] = [];
	let marked: string | undefined;
	let frameDrawn: (() => void) | undefined;
	const hover = createCanvasHover(
		{
			afterFrame(listener) {
				frameDrawn = listener;
				return () => {
					frameDrawn = undefined;
				};
			},
			show(world) {
				const solids = targets.get(world);
				assert.ok(solids);
				displayed = solids;
			},
			pickCell: (x, y) => scene.select(x, y, displayed)
		},
		(id) => {
			marked = id;
		}
	);
	const detailed = { ...seed, roofBuilder };
	const towns = [];
	for (const world of [seed, detailed]) {
		const town = await render(world);
		towns.push(town);
		checkTown(world, town);
	}
	// This probe already runs in an isolated process for the Svelte theme double.
	Object.assign(globalThis, { window: new EventTarget(), cancelAnimationFrame() {} });
	const uninterrupted = checkHeldErase(scene.view, hover, seed, seed, position);
	assert.deepEqual(checkHeldErase(scene.view, hover, seed, detailed, position), uninterrupted);
	for (const town of towns) town.dispose();
	scene.ground.geometry.dispose();
	scene.ground.material.dispose();
	function checkTown(world: World, town: Awaited<ReturnType<typeof render>>) {
		checkAllViews(world, scene, town);
		scene.view.setPlan(false);
		scene.view.frameBox(scene.bounds, 1.1);
		scene.view.zoomAt(0.11, 600.6063, 438.9481);
		const { x, y } = position;
		targets.set(world, town.solids);
		hover.show(world, 'all');
		frameDrawn?.();
		if (!world.roofBuilder) hover.move(position);
		const ray = new THREE.Raycaster();
		ray.params.Line.threshold = scene.view.metersPerPixel() / 2;
		ray.setFromCamera(scene.view.ndc(x, y), scene.view.camera);
		const hit = ray.intersectObjects([scene.ground, ...town.visible], false)[0];
		const expected =
			hit.object.userData.cellId ?? cellAtPoint(world.grid, hit.point.x, -hit.point.z)?.id;
		assert.equal(world.grid.cells[scene.select(x, y, town.solids) ?? -1]?.id, expected);
		assert.equal(expected, world.roofBuilder ? '81/38' : '81/39');
		assert.equal(marked, expected);
		const clicked = hover.cellAt(x, y);
		assert.ok(clicked);
		assert.equal(clicked.id, marked);
		const erased = applyEdit(world, { kind: 'clear', cellId: clicked.id });
		assert.equal(erased.state.stacks.has(clicked.id), false);
		const neighbor = expected === '81/38' ? '81/39' : '81/38';
		assert.equal(erased.state.stacks.get(neighbor), world.state.stacks.get(neighbor));
	}
}

function checkAllViews(
	world: World,
	scene: ReturnType<typeof setup>,
	town: Awaited<ReturnType<typeof render>>
) {
	for (const plan of [false, true])
		for (const zoom of [1, 0.4, 0.11]) checkView(world, scene, town, plan, zoom);
}
