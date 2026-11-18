import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import * as three from 'three';
import { flowToken } from '../../data/focus';
import * as generators from '../../logic/art-reference';

// Bun's module replacements persist across tests. Isolate the renderer and DOM doubles.
if (process.env.ART_PLATE_MOUNT_PROBE === '1') await exerciseThemeBinding();
else
	test('the mounted theme callback redraws both studies without generating geometry', () => {
		const probe = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
			encoding: 'utf8',
			env: { ...process.env, ART_PLATE_MOUNT_PROBE: '1' }
		});
		assert.equal(probe.status, 0, probe.stderr);
	});

async function exerciseThemeBinding() {
	// @ts-expect-error Bun supplies its test API at runtime.
	const { mock, spyOn } = await import('bun:test');
	let refresh: () => void = () => {
		throw new Error('Theme callback was not registered');
	};
	let group: three.Object3D | undefined,
		draws = 0;
	class Renderer {
		setPixelRatio() {}
		setSize() {}
		dispose() {}
		forceContextLoss() {}
		render(scene: three.Scene) {
			group = scene.children.at(-1);
			draws++;
		}
	}
	const original = { ...three };
	mock.module('three', () => ({ ...original, WebGLRenderer: Renderer }));
	let tone = '#eeeeee';
	mock.module('../themeBinding', () => ({
		bindSceneTheme(_canvas: unknown, _scene: unknown, _renderer: unknown, callback: () => void) {
			refresh = callback;
			refresh();
			return () => {};
		},
		resolveTokens: () => ({
			'--paper-2': tone,
			'--ink': tone,
			'--ink-3': tone,
			[flowToken.water]: tone
		})
	}));
	Object.assign(globalThis, {
		devicePixelRatio: 1,
		ResizeObserver: class {
			observe() {}
			disconnect() {}
		}
	});
	const canvas = {
		parentElement: {},
		getBoundingClientRect: () => ({ width: 640, height: 400 })
	} as HTMLCanvasElement;
	const collage = spyOn(generators, 'composeCollage'),
		vessel = spyOn(generators, 'buildVessel');
	const { mountPlate } = await import('./index');
	for (const kind of ['collage', 'vessel'] as const) {
		collage.mockClear();
		vessel.mockClear();
		const mounted = mountPlate(canvas, kind, 17);
		const calls = () => [collage.mock.calls.length, vessel.mock.calls.length];
		const initial = calls(),
			before = group,
			previousDraws = draws;
		assert.ok(initial[kind === 'collage' ? 0 : 1] > 0);
		tone = '#222222';
		refresh();
		assert.deepEqual(calls(), initial);
		assert.ok(before);
		assert.equal(group, before);
		assert.equal(draws, previousDraws + 1);
		const outline = before.children[0] as three.LineLoop<
			three.BufferGeometry,
			three.LineBasicMaterial
		>;
		assert.equal(outline.material.color.getHexString(), '222222');
		mounted.update(18);
		assert.notDeepEqual(calls(), initial);
		mounted.dispose();
		tone = '#eeeeee';
	}
}
