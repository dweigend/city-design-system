import * as THREE from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import { readPalette } from '../themeBinding';
import { grammatik } from '../leitstil';
import { sandboxStyle } from './drafting-style';
import { structureMaterials } from './structure-materials';
import { populateStructures } from './structure-parts';

/** Photographs one sandbox structure at a time using one shared renderer per sheet. */
export async function createAssetPlate(host: HTMLElement) {
	const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: true });
	try {
		await renderer.init();
	} catch (error) {
		renderer.dispose();
		throw error;
	}
	const width = 440,
		height = 300;
	renderer.setSize(width, height, false);
	const scene = new THREE.Scene();
	const style = sandboxStyle({
		zoom: 'nah',
		modus: 'ansehen',
		situation: 'normal',
		thema: document.documentElement.dataset.theme === 'dark' ? 'dunkel' : 'hell'
	});
	const tones = grammatik(host, style);
	scene.background = tones.paper;
	const finishes = structureMaterials();
	finishes.explicit.setPalette(readPalette(host));
	const dot = new THREE.SphereGeometry(0.04);
	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 200);
	const sky = new THREE.HemisphereLight(0xffffff, 0xd9d7cf, 2);
	const sun = new THREE.DirectionalLight(0xffffff, 2);
	sun.position.set(5, 10, 4);
	scene.add(sky, sun);
	return {
		photo(parts: Primitive[]) {
			finishes.setStyle(style, 'all', 48, tones);
			const group = populateStructures(parts, finishes, dot);
			scene.add(group);
			try {
				const bounds = new THREE.Box3().setFromObject(group);
				const centre = bounds.getCenter(new THREE.Vector3());
				const size = bounds.getSize(new THREE.Vector3());
				camera.position
					.copy(centre)
					.add(new THREE.Vector3(1, 0.55, 1.45).normalize().multiplyScalar(60));
				camera.lookAt(centre);
				camera.updateMatrixWorld();
				const e = camera.matrixWorld.elements;
				const extent = (i: number) =>
					Math.abs(e[i]) * size.x + Math.abs(e[i + 1]) * size.y + Math.abs(e[i + 2]) * size.z;
				const span = Math.max(extent(4), (extent(0) * height) / width, 0.1) * 1.13;
				camera.top = span / 2;
				camera.bottom = -camera.top;
				camera.right = (camera.top * width) / height;
				camera.left = -camera.right;
				camera.updateProjectionMatrix();
				renderer.render(scene, camera);
				return renderer.domElement.toDataURL();
			} finally {
				scene.remove(group);
				const geometries = new Set<THREE.BufferGeometry>();
				group.traverse((o) => {
					if (o instanceof THREE.Mesh) geometries.add(o.geometry);
				});
				for (const g of geometries) if (g !== dot) g.dispose();
			}
		},
		dispose() {
			dot.dispose();
			finishes.dispose();
			renderer.dispose();
		}
	};
}
