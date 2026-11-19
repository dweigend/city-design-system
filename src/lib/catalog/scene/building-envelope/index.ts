import * as THREE from 'three';
import type { EnvelopePlateMesh } from '../../logic/envelope-plate';
import { bindSceneTheme } from '../themeBinding';

import { plateModel } from './plate-model';

/** Draws all specimens with a shared camera, light and scale. Releases GPU resources on teardown. */
export function renderEnvelopePlate(
	canvas: HTMLCanvasElement,
	meshes: EnvelopePlateMesh[],
	targets: HTMLCanvasElement[]
) {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	renderer.setSize(480, 256, false);
	const scene = new THREE.Scene(),
		camera = new THREE.OrthographicCamera(-16.125, 16.125, 8.6, -8.6, 0.1, 100);
	const sun = new THREE.DirectionalLight(0xffffff, 1.6);
	sun.position.set(-6, 12, 5);
	scene.add(sun, new THREE.AmbientLight(0xffffff, 1.3));
	const paper = new THREE.MeshStandardMaterial({
		flatShading: true,
		roughness: 1,
		polygonOffset: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1
	});
	const glaze = paper.clone();
	glaze.roughness = 0.23;
	const line = new THREE.LineBasicMaterial();
	const finishes = { paper, glaze };
	const models = meshes.map((mesh) => plateModel(mesh, finishes, line));
	function draw(plan: boolean) {
		if (plan) camera.position.set(0, 35, 0.001);
		else camera.position.set(24, 21, 16);
		camera.lookAt(0, 0, 0);
		models.forEach(({ solid }, i) => {
			scene.add(solid);
			renderer.render(scene, camera);
			scene.remove(solid);
			const target = targets[i];
			target.getContext('2d')?.drawImage(canvas, 0, 0, target.width, target.height);
		});
	}
	let plan = false;
	const stopTheme = bindSceneTheme(canvas, scene, renderer, (palette) => {
		paper.color.set(palette.paper);
		glaze.color.set(palette.blueprintSoft);
		line.color.set(palette.ink);
		// Keep the shaded faces legible when paper is the dark background.
		if (paper.color.getHex() < line.color.getHex()) {
			paper.color.lerp(line.color, 0.29);
			glaze.color.lerp(line.color, 0.27);
		}
		draw(plan);
	});
	return {
		view(top: boolean) {
			plan = top;
			draw(top);
		},
		dispose() {
			stopTheme();
			models.forEach((m) => m.dispose());
			paper.dispose();
			glaze.dispose();
			line.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
		}
	};
}
