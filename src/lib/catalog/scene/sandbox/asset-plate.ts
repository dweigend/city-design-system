import { createParametrikScene } from '../parametrik';
import * as THREE from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import { readPalette } from '../themeBinding';
import { grammatik } from '../leitstil';
import { sandboxStyle } from './drafting-style';
import { structureMaterials } from './structure-materials';
import { populateStructures } from './structure-parts';

/** Photographs one sandbox structure at a time using one shared renderer per sheet. */
export async function createAssetPlate(host: HTMLElement) {
	const canvas = document.createElement('canvas');
	const palette = readPalette(host);
	const stage = createParametrikScene(canvas, palette, () => {}, false);
	try {
		await stage.ready;
	} catch (error) {
		await disposeStage();
		throw error;
	}
	stage.resize(440, 300);
	const style = sandboxStyle({
		zoom: 'nah',
		modus: 'ansehen',
		situation: 'normal',
		thema: document.documentElement.dataset.theme === 'dark' ? 'dunkel' : 'hell'
	});
	const tones = grammatik(host, style);

	const finishes = structureMaterials();
	finishes.explicit.setPalette(palette);
	finishes.setStyle(style, 'all', 48, tones);
	const dot = new THREE.SphereGeometry(0.04);
	return {
		async photo(parts: Primitive[]) {
			const group = populateStructures(parts, finishes, dot);
			try {
				return await stage.snapshotDrawing(group, [1, -1.45, 0.55]);
			} finally {
				const geometries = new Set<THREE.BufferGeometry>();
				group.traverse((o) => {
					if (o instanceof THREE.InstancedMesh) o.dispose();
					if (o instanceof THREE.Mesh) geometries.add(o.geometry);
				});
				for (const g of geometries) if (g !== dot) g.dispose();
			}
		},
		async dispose() {
			dot.dispose();
			finishes.dispose();
			await disposeStage();
		}
	};

	async function disposeStage() {
		await stage.dispose();
		// Three releases the WebGL context itself only when it created the canvas.
		if (canvas.dataset.backend === 'webgl2')
			canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
	}
}
