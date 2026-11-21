import type { Object3D } from 'three/webgpu';
import type { ViewMode } from '../../data/view-modes';
import type { ResolvedView } from '../../logic/view-modes';
import type { TerrainMesh } from './terrain-mesh';
import type { View } from './view';

type Layers = {
	terrain?: TerrainMesh;
	marks: readonly (Object3D | undefined)[];
};

const poses = {
	iso: undefined,
	plan: { elevation: Math.PI / 2, margin: 1.45 },
	terrain: { elevation: Math.PI / 3, margin: 1.5 }
} satisfies Record<ViewMode, Parameters<View['setInspection']>[0]>;

/** Applies the controlled view to the stage's retained camera and draw layers. */
export function createViewMode(view: View, structures: Object3D, vehicles: Object3D) {
	let current: ResolvedView | undefined;

	function apply(layers: Layers, selection: ResolvedView | undefined, legacyPlan = false) {
		const { terrain, marks } = layers;
		const terrainOnly = selection?.view === 'terrain';
		terrain?.setGridVisible(Number(selection ? selection.view === 'plan' : legacyPlan));
		terrain?.setInspection(selection?.view);
		structures.visible = vehicles.visible = !terrainOnly;
		for (const mark of marks) if (mark) mark.visible = !terrainOnly;
	}

	function applyLayers(layers: Layers, legacyPlan: boolean) {
		apply(layers, current, legacyPlan);
	}

	return {
		get active() {
			return current !== undefined;
		},
		get terrainOnly() {
			return current?.view === 'terrain';
		},
		get iso() {
			return current?.view === 'iso';
		},
		applyLayers,
		/** Includes hidden draw layers in the first render after a world or palette update. */
		warm(root: Object3D, layers: Layers, draw: () => void) {
			apply(layers, undefined);
			try {
				warmViewLayers(root, draw);
			} finally {
				apply(layers, current);
			}
		},
		/** Changes only the view and returns whether the stage needs a frame. */
		set(next: ResolvedView | undefined, layers: Layers, legacyPlan: boolean) {
			if (current?.view === next?.view && current?.display === next?.display) return false;
			current = next;
			const pose = next && poses[next.view];
			view.setInspection(next?.view === 'iso' && legacyPlan ? { margin: 1.45 } : pose);
			applyLayers(layers, legacyPlan);
			return true;
		}
	};
}

function warmViewLayers(root: Object3D, draw: () => void) {
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
	}
}
