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
		stage.dispose();
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
	const dot = new THREE.SphereGeometry(0.04);
	return {
		photo(parts: Primitive[]) {
			finishes.setStyle(style, 'all', 48, tones);
			const group = populateStructures(parts, finishes, dot);
			try {
				return stage.snapshotDrawing(group, [1, -1.45, 0.55]);
			} finally {
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
			stage.dispose();
		}
	};
}
