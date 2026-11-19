import { savedCarrier } from '../../logic/sandbox/fixtures/saved-carrier.fixture.test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import * as T from 'three/webgpu';
import { BLICK } from '../../data/leitstil';
import {
	applyEdit,
	beginStroke,
	createWorld,
	extendStroke,
	installationView,
	type World
} from '../../logic/sandbox';
import { contourWidthMeters } from './contour-width';
import { frameClock } from './fixtures/frame-clock';
import type { SandboxStage } from './stage';

// Isolate the renderer prototype and the manual animation clock from the other scene tests.
if (process.env.SANDBOX_CONTOUR_FRAME_TEST === '1') await exerciseFrames();
else
	test(
		'newly installed and seed-reset ceramic use their first rendered camera',
		{ timeout: 15000 },
		() => {
			const probe = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
				encoding: 'utf8',
				timeout: 14000,
				env: { ...process.env, SANDBOX_CONTOUR_FRAME_TEST: '1' }
			});
			assert.equal(probe.status, 0, probe.stderr);
		}
	);

function outlined(scene: T.Scene, count: number) {
	let body: T.Mesh | undefined;
	scene.traverse((o) => {
		if (
			o instanceof T.Mesh &&
			o.parent?.userData.hits?.includes(o) &&
			o.geometry.getAttribute('position').count === count
		)
			body = o;
	});
	assert(body?.parent, 'missing ceramic fill');
	const face = body;
	return body.parent.children.some(
		(o) =>
			o !== face &&
			o instanceof T.Mesh &&
			o.geometry.getAttribute('position') === face.geometry.getAttribute('position')
	);
}
async function exerciseFrames() {
	const clock = frameClock();
	const { createSandboxStage } = await import('./stage');
	const base = applyEdit(createWorld(7), {
		kind: 'line',
		transit: 'viaduct',
		cellIds: ['74/35', '96/35']
	});
	const stroke = (w: World, style: 'megastructure' | 'totem') =>
		['90/40', '94/40'].reduce(extendStroke, beginStroke({ kind: 'house', style, use: 'water' }, w))
			.draft;
	const carrier = savedCarrier(base, '90/40', 'water'),
		installed = stroke(carrier, 'totem');
	const body = installationView(installed, 'all', true).find(
		(p) => p.kind === 'mesh' && p.token === '--paper'
	);
	assert(body?.kind === 'mesh');
	const width = contourWidthMeters(body, BLICK.hoeheRad);
	const setPx = (s: SandboxStage, px: number) => {
		s.view.zoomAt(width / px / s.view.metersPerPixel(), 600, 400);
		s.render();
	};
	const stage = createSandboxStage(clock.canvas(), assert.fail);
	stage.resize(1200, 800);
	await stage.ready;
	stage.show(carrier, 'all');
	setPx(stage, 5.8);
	clock.draw();
	setPx(stage, 6.2);
	stage.show(installed, 'all');
	assert(targetWidth(stage) > 6 && targetWidth(stage) < 6.6);
	assert(!outlined(clock.draw(), body.triangles.length));
	stage.dispose();

	const playable = createSandboxStage(clock.canvas(), assert.fail, { frameTown: true });
	playable.resize(1200, 800);
	await playable.ready;
	playable.show(carrier, 'all');
	playable.setTime(4.9);
	clock.draw(1000);
	playable.show(installed, 'all', true);
	const sample = (seconds: number, stamp: number) => {
		playable.setTime(seconds);
		const scene = clock.draw(stamp);
		const poses: number[][] = [];
		const cars: number[][] = [];
		scene.traverseVisible((object) => {
			if (!(object instanceof T.Mesh)) return;
			poses.push(object.matrixWorld.elements.slice());
			if (object.geometry instanceof T.CapsuleGeometry)
				cars.push(object.matrixWorld.elements.slice());
		});
		assert(cars.length);
		return { poses, cars };
	};
	const first = sample(5, 2000);
	playable.render();
	clock.draw(4000);
	playable.setTransitPaused(true);
	assert.notDeepEqual(sample(5.5, 6000).cars, first.cars);
	assert.deepEqual(sample(5, 7000), first);
	playable.dispose();

	function targetWidth(s: SandboxStage) {
		return width / s.view.metersPerPixel();
	}
	const height = (800 * width) / 6.2 / 1.1 / Math.cos(BLICK.hoeheRad) - 3;
	const reset = createSandboxStage(clock.canvas(), assert.fail, {
		frame: [
			[-1, -1, 0],
			[1, 1, height]
		],
		additions: [body]
	});
	reset.resize(1200, 800);
	await reset.ready;
	reset.show(base, 'all');
	const opening = targetWidth(reset);
	assert(opening > 6 && opening < 6.6);
	assert(!outlined(clock.draw(), body.triangles.length));
	setPx(reset, 5.2);
	assert(!outlined(clock.draw(), body.triangles.length));
	reset.show(createWorld(8), 'all');
	assert.equal(targetWidth(reset), opening);
	assert(!outlined(clock.draw(), body.triangles.length));
	reset.dispose();
}
