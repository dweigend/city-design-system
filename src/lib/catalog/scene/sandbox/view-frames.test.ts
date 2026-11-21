import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createWorld } from '../../logic/sandbox';
import { frameClock } from './fixtures/frame-clock';

// The manual clock patches renderer prototypes, so this test runs in its own process.
if (process.env.SANDBOX_VIEW_FRAME_TEST === '1') await exerciseZoom();
else
	test('iso and terrain present consecutive zoom frames while paused', () => {
		const probe = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
			encoding: 'utf8',
			timeout: 12000,
			env: { ...process.env, SANDBOX_VIEW_FRAME_TEST: '1' }
		});
		assert.equal(probe.status, 0, probe.stderr);
	});

async function exerciseZoom() {
	const clock = frameClock();
	const { createSandboxStage } = await import('./stage');
	const canvas = clock.canvas();
	const stage = createSandboxStage(canvas, assert.fail);
	try {
		stage.resize(1200, 800);
		await stage.ready;
		stage.setView({ view: 'iso', display: 'normal' });
		stage.show(createWorld(7), 'all');
		stage.setTime(0);
		clock.draw();
		clock.draw(16);
		assert.ok(Number(canvas.dataset.frame) > 0, 'the opening frame was presented');
		const zoom = canvas.dataset.zoom;

		for (const view of ['iso', 'terrain'] as const) {
			stage.setView({ view, display: 'normal' });
			clock.draw();
			const shown = Number(canvas.dataset.frame);
			for (let i = 1; i <= 8; i++) {
				stage.view.zoomAt(0.999, 600, 400);
				stage.viewChanged();
				clock.draw(i * 16);
				assert.equal(Number(canvas.dataset.frame), shown + i, view + ' dropped a zoom frame');
				assert.equal(canvas.dataset.zoom, zoom);
			}
		}
	} finally {
		stage.dispose();
	}
}
