import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createWorld } from '../../logic/sandbox';
import { createHouseCourt } from '../../logic/house-court';
import { createParcelDeck } from '../../logic/parcel-deck';
import { createHouseCourtContext } from '../house-court';
import { frameClock } from './fixtures/frame-clock';

// The manual clock patches renderer prototypes, so this test runs in its own process.
const scenario = process.env.SANDBOX_VIEW_FRAME_TEST;
if (scenario === 'zoom') await exerciseZoom();
else if (scenario === 'perspective') await exercisePerspective();
else {
	test('iso and terrain present consecutive zoom frames while paused', () => runScenario('zoom'));
	test('a large court context refits on view switches and keeps plan on resize', () =>
		runScenario('perspective'));
}

function runScenario(scenario: string) {
	const probe = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
		encoding: 'utf8',
		timeout: 12000,
		env: { ...process.env, SANDBOX_VIEW_FRAME_TEST: scenario }
	});
	assert.equal(probe.status, 0, probe.stderr);
}

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

async function exercisePerspective() {
	const clock = frameClock();
	const { createSandboxStage } = await import('./stage');
	const deck = createParcelDeck({
		id: 'wide-plot',
		entrance: [
			[0, 0, 0],
			[30, 0, 0]
		],
		depth: 30
	});
	const house = createHouseCourt(deck);
	const context = createHouseCourtContext(deck, house);
	assert.throws(
		() =>
			createHouseCourtContext(
				{
					...deck,
					plotRing: [
						[0, 0, 0],
						[1e40, 0, 0],
						[1e40, 1e40, 0],
						[0, 1e40, 0]
					]
				},
				house
			),
		/camera range must fit 32-bit coordinates/
	);
	const stage = createSandboxStage(clock.canvas(), assert.fail, { context });
	try {
		stage.resize(390, 281);
		await stage.ready;
		stage.setView({ view: 'iso', display: 'normal' });
		clock.draw();
		clock.draw(16);
		const camera = clock.renderedCamera();
		const initialEye = camera.position.clone();
		assert.ok(Math.abs(initialEye.z - stage.view.target.z) > 1);
		for (const point of context.perspective?.points ?? []) {
			const { x, y } = point.clone().project(camera);
			assert.ok(Math.abs(x) < 1 && Math.abs(y) < 1, 'the wide plot fits');
		}

		stage.setPlan(true);
		clock.draw(32);
		assert.ok(Math.abs(camera.position.z - stage.view.target.z) < 1e-6);
		stage.resize(1280, 400);
		clock.draw(48);
		assert.ok(Math.abs(camera.position.z - stage.view.target.z) < 1e-6);
		stage.setView({ view: 'iso', display: 'normal' });
		clock.draw(64);
		assert.ok(camera.position.distanceTo(initialEye) < 1e-6);
	} finally {
		stage.dispose();
	}
}
