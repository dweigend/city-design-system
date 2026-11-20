import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Color, InstancedMesh, type Object3D } from 'three/webgpu';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { houseChunk, raise } from '../logic/house-brush';
import { squareGrid } from '../logic/quad-grid';
import { scenePalette } from './scene-palette';
import { frameClock } from './sandbox/fixtures/frame-clock';

if (process.env.RULE_PLATE_TEST === '1') await exercise();
else
	test('rule plates and game project the same house members and declared bearings at every zoom', () => {
		const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
			encoding: 'utf8',
			timeout: 10000,
			env: { ...process.env, RULE_PLATE_TEST: '1' }
		});
		assert.equal(run.status, 0, run.stderr || String(run.error));
	});

function marks(root: Object3D, color: Color) {
	const widths: number[] = [];
	let seats = 0;
	root.traverse((o) => {
		if (o instanceof LineSegments2 && o.material.color.equals(color))
			widths.push(o.material.linewidth);
		if (o instanceof InstancedMesh && o.material.visible) seats += o.count;
	});
	return { widths: widths.sort((a, b) => a - b), seats };
}

async function exercise() {
	const clock = frameClock();
	const ink3 = '#9d8574';
	Object.assign(globalThis, {
		getComputedStyle: (el: HTMLElement) => ({
			color: el.style?.color === 'var(--ink-3)' ? ink3 : '#454851',
			getPropertyValue: () => ''
		})
	});
	const [{ createParametrikScene }, { createStructures }, { applyStructureStyle }] =
		await Promise.all([
			import('./parametrik'),
			import('./sandbox/structures'),
			import('./sandbox/structure-style')
		]);
	const canvas = clock.canvas();
	const palette = scenePalette((names) =>
		Object.fromEntries(names.map((n) => [n, n === '--ink-3' ? ink3 : '#454851']))
	);
	const stage = createParametrikScene(canvas, palette, assert.fail, false);
	const game = createStructures(undefined, true);
	try {
		await stage.ready;
		stage.resize(600, 400);
		const grid = squareGrid(3, 3, 5);
		const cell = grid.cells[4],
			stacks = raise(new Map(), cell.id, 'water');
		const context = { occupied: stacks, blockOf: () => undefined, olderRoof: () => false };
		for (const style of ['megastructure', 'totem'] as const) {
			const parts = houseChunk(grid, stacks, cell.chunk, 7, style, context);
			stage.updateRulePlate(parts);
			game.set('house', parts);
			for (const scale of [10, 20, 2]) {
				stage.frame({ center: cell.center, span: 200 / scale });
				applyStructureStyle(game, canvas, scale, Math.PI / 6, true);
				const plate = marks(clock.draw(), new Color(ink3));
				assert.deepEqual(plate, marks(game.group, new Color(ink3)));
				assert(plate.widths.length > 0);
				assert.equal(plate.seats, scale === 2 ? 0 : style === 'totem' ? 2 : 4);
				if (scale >= 10) assert(plate.widths.includes(0.12 * scale));
			}
		}
	} finally {
		game.dispose();
		await stage.dispose();
	}
}
