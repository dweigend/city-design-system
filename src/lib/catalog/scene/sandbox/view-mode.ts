import type { Object3D } from 'three/webgpu';
import type { ResolvedView } from '../../logic/view-modes';
import type { TerrainLook } from './terrain-look';
import type { TerrainMesh } from './terrain-mesh';
import type { View } from './view';

type Layers = {
	terrain?: TerrainMesh;
	marks: readonly (Object3D | undefined)[];
};

const planPose = { elevation: Math.PI / 2, margin: 1.45 };
type Selection = { resolved: ResolvedView; editable: boolean };

/** Applies the controlled view to the stage's retained camera and draw layers. */
export function createViewMode(view: View, look: TerrainLook, vehicles: Object3D) {
	let current: Selection | undefined;

	function apply(layers: Layers, selection?: Selection) {
		const { terrain, marks } = layers;
		const mode = selection?.resolved.view;
		const relief = mode === 'terrain';
		terrain?.setInspection(mode, selection?.editable);
		look.set(relief);
		vehicles.visible = !relief;
		for (const mark of marks) if (mark) mark.visible = !relief;
	}

	function applyPlan(selection: Selection, enabled: boolean) {
		if (selection.editable) view.setPlan(enabled);
		else view.setInspection(enabled ? planPose : undefined);
	}

	return {
		get retainsDrafting() {
			return current?.editable === false;
		},
		/** Restores the selected treatment when the stage replaces a layer. */
		applyLayers(layers: Layers) {
			apply(layers, current);
		},
		/** Includes every retained draw layer in the offscreen warm-up. */
		warm(root: Object3D, layers: Layers, draw: () => void) {
			apply(layers);
			const culled: Object3D[] = [];
			root.traverse((object) => {
				if (!object.frustumCulled) return;
				culled.push(object);
				object.frustumCulled = false;
			});
			try {
				draw();
			} finally {
				for (const object of culled) object.frustumCulled = true;
				apply(layers, current);
			}
		},
		/** Changes only the view and returns whether the stage needs a frame. */
		set(resolved: ResolvedView, layers: Layers, editable: boolean) {
			if (
				current?.resolved.view === resolved.view &&
				current.resolved.display === resolved.display &&
				current.editable === editable
			)
				return false;
			if (!current && editable && resolved.view === 'iso') return false;
			if (current?.resolved.view === 'plan') applyPlan(current, false);
			const next = { resolved, editable };
			if (resolved.view === 'plan') applyPlan(next, true);
			current = next;
			apply(layers, next);
			return true;
		}
	};
}
