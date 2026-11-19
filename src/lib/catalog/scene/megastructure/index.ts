import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { plateModel } from './model';
import { bindSceneTheme, resolveTokens } from '../themeBinding';
import { flowToken } from '../../data/focus';
function coloredModel(canvas: HTMLCanvasElement) {
	const host = canvas.parentElement ?? document.body;
	const c = resolveTokens(host, [
		'--paper',
		'--line',
		'--paper-3',
		'--ink-3',
		...Object.values(flowToken)
	]);
	return plateModel({
		paper: c['--paper'],
		stock: c['--paper-3'],
		steel: c['--ink-3'],
		window: c['--line'],
		pink: c[flowToken.people],
		blue: c[flowToken.water],
		orange: c[flowToken.material],
		yellow: c[flowToken.energy]
	});
}
function release(model: T.Group) {
	model.traverse((o) => {
		if (o instanceof T.Mesh || o instanceof T.LineSegments) {
			o.geometry.dispose();
			o.material.dispose();
		}
	});
}
/** Mounts the orthographic study. The caller owns reset and disposal. */
export function mountPlate(canvas: HTMLCanvasElement) {
	const renderer = new T.WebGLRenderer({ canvas, antialias: true });
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	const scene = new T.Scene(),
		camera = new T.OrthographicCamera(-20, 20, 14, -14, 0.1, 200);
	let model = new T.Group();
	const sun = new T.DirectionalLight(0xffffff, 2);
	sun.position.set(-10, 24, 20);
	scene.add(new T.HemisphereLight(0xffffff, 0xd5d1c8, 1.8), sun);
	const controls = new OrbitControls(camera, canvas);
	controls.target.set(15, 5, 2);
	camera.position.set(35, 21, 43);
	controls.update();
	controls.saveState();
	controls.listenToKeyEvents(canvas);
	function draw() {
		renderer.render(scene, camera);
	}
	function resize() {
		const w = canvas.clientWidth,
			h = canvas.clientHeight,
			half = Math.max(12, (18 * h) / w);
		camera.top = half;
		camera.bottom = -half;
		camera.left = (-half * w) / h;
		camera.right = -camera.left;
		camera.updateProjectionMatrix();
		renderer.setSize(w, h, false);
		draw();
	}
	controls.addEventListener('change', draw);
	const stopTheme = bindSceneTheme(canvas, scene, renderer, () => {
		scene.remove(model);
		release(model);
		model = coloredModel(canvas);
		scene.add(model);
		draw();
	});
	const observer = new ResizeObserver(resize);
	observer.observe(canvas);
	resize();
	return {
		reset: () => controls.reset(),
		dispose() {
			observer.disconnect();
			controls.dispose();
			stopTheme();
			release(model);
			renderer.dispose();
		}
	};
}
