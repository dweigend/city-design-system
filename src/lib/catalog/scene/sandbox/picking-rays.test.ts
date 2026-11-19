import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import init from 'manifold-3d';
import * as THREE from 'three/webgpu';
import { createRoofBuilder } from '../../logic/building-envelope';
import { hash } from '../../logic/hash-random';
import { focuses } from '../../logic/presentation';
import { createWorld, currentStacks, houseView } from '../../logic/sandbox';
import { cellAtPoint } from '../../logic/terrain-grid';
import { createCellPicker } from './house-picker';
import { createView } from './view';
import { surfaceGeometry } from './terrain-geometry';

// The browser compiles Svelte runes. Isolate the theme double when loading the real batcher in Bun.
if (process.env.HOUSE_RAY_PROBE === '1') await compareRays();
else
	test('random opening-view rays pick the visible stock cell with two-pixel silhouette tolerance', () => {
		const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
			env: { ...process.env, HOUSE_RAY_PROBE: '1' },
			encoding: 'utf8'
		});
		assert.equal(run.status, 0, run.stderr);
	});

async function renderedTown() {
	// @ts-expect-error Bun supplies its test API at runtime.
	const { mock } = await import('bun:test');
	mock.module('../themeBinding', () => ({ bindSceneTheme: () => {} }));
	const { batch, geometryOf } = await import('../batch');
	const kernel = await init();
	kernel.setup();
	const world = {
		...createWorld(7),
		roofBuilder: createRoofBuilder(kernel, (_id, error) => {
			throw error;
		})
	};
	const color = new THREE.Color();
	const material = new THREE.MeshBasicMaterial();
	const houses: THREE.Mesh[] = [];
	const targets = [];
	for (const chunk of world.grid.chunks.keys()) {
		const primitives = houseView(world, currentStacks(world.state), chunk, focuses.all);
		if (!primitives.length) continue;
		const faces = batch(primitives, () => color).alt;
		houses.push(new THREE.Mesh(geometryOf(faces), material));
		for (const part of primitives)
			if (part.kind === 'mesh') {
				const cell = world.grid.cellsById.get(part.id.split('@')[0]);
				assert.ok(cell);
				targets.push(new THREE.Vector3(cell.center[0], part.points[0][2], -cell.center[1]));
			}
	}
	return { world, houses, targets, material };
}

async function compareRays() {
	const { world, houses, targets, material } = await renderedTown();
	const view = createView();
	view.resize(1200, 800);
	const ground = surfaceGeometry(world.grid);
	ground.computeBoundingBox();
	assert.ok(ground.boundingBox);
	view.frameBox(ground.boundingBox, 1.1);
	ground.dispose();
	const picker = createCellPicker(view, () => undefined);
	picker.update(world);
	const ray = new THREE.Raycaster();
	const renderHit = (x: number, y: number) => {
		ray.setFromCamera(view.ndc(x, y), view.camera);
		const hit = ray.intersectObjects(houses, false)[0];
		return hit && cellAtPoint(world.grid, hit.point.x, -hit.point.z)?.index;
	};
	let exact = 0,
		edges = 0;
	for (let i = 0; i < 800; i++) {
		const projected = targets[Math.floor(hash(7, i, 0) * targets.length)]
			.clone()
			.project(view.camera);
		const x = (projected.x + 1) * 600 + (hash(7, i, 1) - 0.5) * 14;
		const y = (1 - projected.y) * 400 + (hash(7, i, 2) - 0.5) * 14;
		const expected = renderHit(x, y);
		if (expected === undefined || !world.state.stacks.has(world.grid.cells[expected].id)) continue;
		if (picker.pick(x, y) === expected) {
			exact++;
			continue;
		}
		// Both projected boundaries must be within two CSS pixels of this ray.
		const offsets = [0.5, 1, 1.5, 2].flatMap((r) =>
			Array.from({ length: 16 }, (_, k) => {
				const angle = (k * Math.PI) / 8;
				return [x + r * Math.cos(angle), y + r * Math.sin(angle)];
			})
		);
		assert.ok(offsets.some(([u, v]) => picker.pick(u, v) === expected));
		assert.ok(offsets.some(([u, v]) => renderHit(u, v) !== expected));
		edges++;
	}
	assert.ok(exact + edges > 600 && exact > 500, String([exact, edges]));
	picker.dispose();
	for (const house of houses) house.geometry.dispose();
	material.dispose();
}
