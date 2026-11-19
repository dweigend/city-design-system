import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Vector3 } from 'three/webgpu';
import {
	applyEdit,
	beginStroke,
	createWorld,
	extendStroke,
	installationView,
	type World
} from '../../logic/sandbox';
import { createCanvasHover } from './canvas-hover';
import { frameClock } from './fixtures/frame-clock';

if (process.env.SANDBOX_HOVER_FRAME_TEST === '1') await exerciseHover();
else
	test(
		'stationary hover follows the rendered body, lip and opening through pick-target changes',
		{ timeout: 30000 },
		() => {
			const probe = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
				encoding: 'utf8',
				timeout: 29000,
				env: { ...process.env, SANDBOX_HOVER_FRAME_TEST: '1' }
			});
			assert.equal(probe.status, 0, probe.stderr);
		}
	);

async function exerciseHover() {
	const clock = frameClock();
	const { createSandboxStage } = await import('./stage');
	const canvas = clock.canvas();
	const stage = createSandboxStage(canvas, assert.fail);
	const base = createWorld(7);
	const draw = (world: World, style: 'megastructure' | 'totem') =>
		['90/40', '94/40'].reduce(
			extendStroke,
			beginStroke({ kind: 'house', style, use: 'water' }, world)
		).draft;
	const carrier = draw(base, 'megastructure'),
		installed = draw(carrier, 'totem');
	const dug = applyEdit(installed, { kind: 'dig', cellId: '90/40' });
	assert.notEqual(dug.grid, installed.grid);
	const canvasWidth = 1200,
		canvasHeight = 800;
	stage.resize(canvasWidth, canvasHeight);
	await stage.ready;
	function pointer() {
		let marked: string | undefined,
			publications = 0,
			x = 0,
			y = 0;
		const hover = createCanvasHover(stage, (id) => {
			marked = id;
			publications++;
		});
		return {
			hover,
			move(px: number, py: number) {
				x = px;
				y = py;
				hover.move({ x, y });
			},
			check() {
				assert.equal(marked, hover.cellAt(x, y)?.id);
				return marked;
			},
			count: () => publications,
			position: () => ({ x, y })
		};
	}
	const pointers = [pointer(), pointer(), pointer()];
	function frame(world: World) {
		for (const p of pointers) p.hover.show(world, 'all');
		const before = pointers.map((p) => p.count());
		stage.render();
		clock.draw();
		return pointers.map((p, i) => {
			assert.equal(p.count(), before[i] + 1);
			return p.check();
		});
	}
	try {
		frame(carrier);
		pointers[0].move(613.68, 439.63);
		pointers[1].move(613.71, 436.08);
		assert.deepEqual(
			pointers.slice(0, 2).map((p) => p.check()),
			['89/42', '87/43']
		);
		assert.deepEqual(frame(installed).slice(0, 2), ['90/40', '90/40']);
		assert.deepEqual(frame(carrier).slice(0, 2), ['89/42', '87/43']);

		stage.setPlan(true);
		frame(carrier);
		const forms = installationView(installed, 'all', true);
		const lip = forms.find((p) => p.kind === 'mesh' && p.token === '--cat-health-3');
		assert(lip?.kind === 'mesh');
		const n = lip.points.length / 2,
			[x, y, z] = lip.points[0],
			opposite = lip.points[n / 2];
		const cx = (x + opposite[0]) / 2,
			cy = (y + opposite[1]) / 2;
		const samples = [
			[cx + 1.13 * (x - cx), cy + 1.13 * (y - cy)],
			[(x + lip.points[n][0]) / 2, (y + lip.points[n][1]) / 2],
			[cx, cy]
		];
		for (const [i, [wx, wy]] of samples.entries()) {
			const s = new Vector3(wx, z, -wy).project(stage.view.camera);
			pointers[i].move(((1 + s.x) * canvasWidth) / 2, ((1 - s.y) * canvasHeight) / 2);
		}
		const background = frame(carrier);
		const fitted = frame(installed);
		assert.deepEqual(fitted.slice(0, 2), ['90/40', '90/40']);
		// The open bore may expose another installation surface below it. Its fresh ray is the oracle.
		assert.deepEqual(frame(carrier), background);
		frame(installed);
		const coarse = stage.view.metersPerPixel();
		const openingZoom = canvas.dataset.zoom;
		for (const p of pointers) {
			const { x: px, y: py } = p.position();
			stage.view.zoomAt(0.02, px, py);
			frame(installed);
			assert.notEqual(canvas.dataset.zoom, openingZoom);
			stage.view.zoomAt(coarse / stage.view.metersPerPixel(), px, py);
			frame(installed);
			assert.equal(canvas.dataset.zoom, openingZoom);
		}
		frame(dug);
	} finally {
		for (const p of pointers) p.hover.dispose();
		stage.dispose();
	}
}
