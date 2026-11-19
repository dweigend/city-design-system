import * as T from 'three';
import { flowToken } from '../../data/focus';
import { bindSceneTheme, resolveTokens } from '../themeBinding';
import { createPlateMaterials, recolorPlate } from './materials';
import { plateModel } from './models';

function disposeModel(group: T.Group) {
	group.traverse((node) => {
		if (node instanceof T.Mesh || node instanceof T.Line) {
			node.geometry.dispose();
		}
	});
}

/** Draw a still orthographic study. Theme and viewport updates reuse one WebGL context. */
export function mountPlate(canvas: HTMLCanvasElement, kind: 'collage' | 'vessel', seed: number) {
	const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	const scene = new T.Scene(),
		camera = new T.OrthographicCamera(-12, 12, 8, -8, 0.1, 100);
	camera.position.set(14, 16, 20);
	camera.lookAt(0, 4, 0);
	scene.add(new T.HemisphereLight(0xffffff, 0x999999, 1.7));
	const light = new T.DirectionalLight(0xffffff, 2);
	light.position.set(-8, 14, 7);
	scene.add(light);
	const materials = createPlateMaterials();
	let group = plateModel(kind, seed, materials);
	scene.add(group);
	function draw() {
		const { width, height } = canvas.getBoundingClientRect();
		if (!width || !height) return;
		const half = Math.max(8.4, (10 * height) / width);
		camera.top = half;
		camera.bottom = -half;
		camera.right = (half * width) / height;
		camera.left = -camera.right;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height, false);
		renderer.render(scene, camera);
	}
	function refresh() {
		const tokens = resolveTokens(canvas.parentElement ?? document.documentElement, [
			'--paper-2',
			'--ink',
			'--ink-3',
			flowToken.water
		]);
		recolorPlate(
			materials,
			tokens['--paper-2'],
			tokens['--ink'],
			tokens['--ink-3'],
			tokens[flowToken.water]
		);
		draw();
	}
	const stopTheme = bindSceneTheme(canvas, scene, renderer, refresh);
	const observer = new ResizeObserver(draw);
	observer.observe(canvas);
	return {
		update(next: number) {
			if (next !== seed) {
				seed = next;
				scene.remove(group);
				disposeModel(group);
				group = plateModel(kind, seed, materials);
				scene.add(group);
				draw();
			}
		},
		dispose(this: void) {
			observer.disconnect();
			stopTheme();
			disposeModel(group);
			Object.values(materials).forEach((m) => m.dispose());
			renderer.dispose();
			renderer.forceContextLoss();
		}
	};
}
