import { ClippingGroup, type Object3D, Plane, Vector3 } from 'three/webgpu';
import type { ResolvedView } from '../../logic/view-modes';
import type { TerrainLook } from './terrain-look';
import type { TerrainMesh } from './terrain-mesh';
import type { View } from './view';
import type { createSectionLayer } from './section-layer';
import type { createSchematicLayer } from './schematic-layer';

type Layers = {
	terrain?: TerrainMesh;
	marks: readonly (Object3D | undefined)[];
};

const planPose = { elevation: Math.PI / 2, margin: 1.45 };
type Selection = { resolved: ResolvedView; editable: boolean; fixedPose: boolean };
const planLike = (mode?: ResolvedView['view']) => mode === 'plan' || mode === 'schematic';

/** Applies the controlled view to the stage's retained camera and draw layers. */
export function createViewMode(
	view: View,
	look: TerrainLook,
	structures: Object3D,
	vehicles: Object3D,
	section: ReturnType<typeof createSectionLayer>,
	schematic: ReturnType<typeof createSchematicLayer>
) {
	let current: Selection | undefined;
	const clip = new ClippingGroup();
	const plane = new Plane();
	const unclipped = new Plane(new Vector3(0, 1, 0), 1e8);
	plane.copy(unclipped);
	clip.clippingPlanes = [plane];
	clip.clipShadows = true;

	function apply(layers: Layers, selection?: Selection) {
		const { terrain, marks } = layers;
		const mode = selection?.resolved.view;
		const relief = mode === 'terrain';
		const cut = mode === 'section' && Boolean(section.frame);
		const graph = mode === 'schematic';
		terrain?.setInspection(mode, selection?.editable);
		plane.copy(cut ? section.plane : unclipped);
		look.set(relief, graph);
		vehicles.visible = !relief && !graph;
		for (const mark of marks) if (mark) mark.visible = !relief && !graph;
		section.setVisibility(cut, mode === 'plan' && !selection?.editable);
		schematic.group.visible = graph;
		for (const batch of structures.children) {
			const key: unknown = batch.userData.batchKey;
			if (typeof key !== 'string' || !(key.startsWith('line:') || key.startsWith('forest:')))
				continue;
			batch.traverse((object) => {
				if (graph) object.layers.disable(0);
				else object.layers.enable(0);
			});
		}
	}

	function applyPose(selection?: Selection) {
		if (selection?.fixedPose) {
			view.setInspection();
			return;
		}
		const mode = selection?.resolved.view;
		if (selection?.editable) {
			view.setPlan(planLike(mode));
		} else if (mode === 'section' && section.frame) {
			view.setInspection({
				elevation: 0,
				heading: section.frame.heading,
				bounds: section.frame.bounds,
				margin: 1.08
			});
		} else {
			view.setInspection(planLike(mode) ? planPose : undefined);
		}
	}

	return {
		clip,
		get retainsDrafting() {
			return current?.editable === false;
		},
		get cut() {
			return current?.resolved.view === 'section' && section.frame ? section.plane : undefined;
		},
		/** Reapplies the section pose after its field has changed. */
		frameSection() {
			if (current?.resolved.view === 'section') applyPose(current);
		},
		/** Restores the selected treatment when the stage replaces a layer. */
		applyLayers(layers: Layers) {
			apply(layers, current);
		},
		/** Includes every retained draw layer in the offscreen warm-up. */
		warm(root: Object3D, layers: Layers, draw: () => void) {
			apply(layers);
			section.setVisibility(true, true);
			schematic.group.visible = true;
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
		set(resolved: ResolvedView, layers: Layers, editable: boolean, fixedPose = false) {
			if (
				current?.resolved.view === resolved.view &&
				current.resolved.display === resolved.display &&
				current.editable === editable
			)
				return false;
			if (!current && editable && resolved.view === 'iso') return false;
			if (current?.editable && !editable && planLike(current.resolved.view)) view.setPlan(false);
			const next = { resolved, editable, fixedPose };
			applyPose(next);
			current = next;
			apply(layers, next);
			return true;
		}
	};
}
