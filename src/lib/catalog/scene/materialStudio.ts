import { studioLights } from './studio-pipeline';
import * as THREE from 'three/webgpu';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Palette3D } from '../data/city3d';
import { flowToken } from '../data/focus';
import { tokenColor } from './material';

const neutral = (r: number, g: number, b: number) =>
	new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

const paper = neutral(0.979, 0.969, 0.945);
const ink = neutral(0.23, 0.23, 0.22);
const shadowColor = neutral(0.42, 0.39, 0.35);
const REFLECTION = 0.24;
const SHADOW = 0.66;
/** Key from the right, slightly behind the stage: the right face is lit, the left one in shade. */
const keyFromRight = new THREE.Vector3(0.94, 1.12, -0.35);

/** Resolve the semantic colors once. Paper and ink belong to the fixed studio scene. */
export function studioPalette(palette: Palette3D): Palette3D {
	return { ...palette, paper: '#' + paper.getHexString(), ink: '#' + ink.getHexString() };
}

/** Fixed paper and ink need no redraw. The remaining studio colors come from the flow contract. */
export function studioFarbwechsel(vorher: Palette3D | undefined, jetzt: Palette3D): boolean {
	if (!vorher) return true;
	return Object.values(flowToken).some(
		(token) => !tokenColor(vorher, token).equals(tokenColor(jetzt, token))
	);
}

/** Fixed studio lighting and fitted shadow receiver. The caller owns the scene and renderer. */
export function createMaterialStudio(
	scene: THREE.Scene,
	renderer: THREE.WebGPURenderer,
	lichtVonRechts = false
) {
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	scene.environmentIntensity = REFLECTION;

	const { key, fill } = studioLights();
	const keyDirection = lichtVonRechts ? keyFromRight : key.position.clone();
	key.castShadow = true;
	key.shadow.mapSize.set(2048, 2048);
	key.shadow.autoUpdate = false;
	key.shadow.normalBias = 0.02;
	key.shadow.bias = -0.0002;
	key.shadow.radius = 2;
	const floor = new THREE.Mesh(
		new THREE.PlaneGeometry(600, 600),
		new THREE.ShadowNodeMaterial({ color: shadowColor, opacity: SHADOW, depthWrite: false })
	);
	floor.rotation.x = -Math.PI / 2;
	floor.position.y = -0.006;
	floor.receiveShadow = true;
	scene.add(key, key.target, fill, floor);
	let environment: ReturnType<THREE.PMREMGenerator['fromScene']> | undefined;

	return {
		/** Generate the reflection environment after the renderer is initialized. */
		init() {
			const room = new RoomEnvironment();
			const generator = new THREE.PMREMGenerator(renderer);
			try {
				environment = generator.fromScene(room, 0.065, 0.1, 70, { size: 128 });
				scene.environment = environment.texture;
			} finally {
				generator.dispose();
				room.dispose();
			}
		},
		/** Fit the shadow frustum to the model bounds in scene coordinates. */
		frame(box: THREE.Box3) {
			const center = box.getCenter(new THREE.Vector3());
			const extent = Math.max(box.getSize(new THREE.Vector3()).length() * 0.85, 2);
			key.target.position.copy(center);
			key.position.copy(keyDirection).normalize().multiplyScalar(40).add(center);
			const camera = key.shadow.camera;
			camera.left = camera.bottom = -extent;
			camera.right = camera.top = extent;
			camera.near = Math.max(0.1, 40 - extent);
			camera.far = 40 + extent;
			camera.updateProjectionMatrix();
			key.shadow.needsUpdate = true;
		},
		/** Refresh the light's cached shadow when the model changes. */
		invalidate() {
			key.shadow.needsUpdate = true;
		},
		/** Release the studio's GPU resources. */
		dispose() {
			key.shadow.dispose();
			floor.geometry.dispose();
			floor.material.dispose();
			environment?.dispose();
			scene.environment = null;
		}
	};
}
