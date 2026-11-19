import { type Material } from 'three/webgpu';
import type { Palette3D } from '../../data/city3d';
import { materials } from '../../data/material';
import { materialAusfuehrungen } from '../../data/materialAusfuehrung';
import { rezept, voreinstellung } from '../../logic/material/rezept';
import { materialLook } from '../../logic/parametrik/material';
import type { ColorToken, FinishId } from '../../logic/parametrik/types';
import { printedFinish } from './printed-finish';
import { finishMaterial } from '../material';
import { createMaterialOberflaechen } from '../materialOberflaeche';

/** Stage-owned materials for explicitly finished surfaces. Changing palette releases cached finishes. */
export function finishMaterials() {
	let close = true;
	const studio = createMaterialOberflaechen();
	const cache = new Map<string, Material>();
	let palette: Palette3D = {
		paper: '#ffffff',
		ink: '#000000',
		blueprint: '#000000',
		blueprintSoft: '#ffffff',
		categories: {}
	};

	function dispose() {
		for (const m of cache.values()) m.dispose();
		cache.clear();
		studio.dispose();
	}

	function material(id: FinishId, token: ColorToken) {
		const key = id + '/' + token;
		const cached = cache.get(key);
		if (cached) return cached;
		const spec = materials.find((m) => m.id === id);
		let face: Material;
		if (id === 'glaze' || id === 'keramik-glasiert' || id === 'beton-terrazzo') {
			face = printedFinish(id === 'beton-terrazzo', token, palette, close);
		} else if (spec) {
			face = finishMaterial(materialLook(spec.id, token), palette, true);
		} else {
			const finish = materialAusfuehrungen.find((m) => m.id === id);
			if (!finish) throw new RangeError('Unknown finish: ' + id);
			const recipe = rezept(finish.familie, voreinstellung(finish.familie, 'neutral'));
			recipe.farbe.token = token;
			face = studio.material(recipe, palette, finish.id, true);
		}
		face.name = id;
		cache.set(key, face);
		return face;
	}
	return {
		material,
		dispose,
		setDetail(next: boolean) {
			if (close === next) return false;
			close = next;
			dispose();
			return true;
		},
		setPalette(next: Palette3D) {
			dispose();
			palette = next;
		}
	};
}
