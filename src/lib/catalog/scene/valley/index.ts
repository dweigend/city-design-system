import { Box3, Color, Group, Mesh, MeshBasicMaterial, type BufferAttribute } from 'three/webgpu';
import type { ValleyField } from '../../logic/valley';
import { VALLEY_PICTURE_SEEDS } from '../../data/valley-references';
import { VALLEY_STUDY_VIEW, valleyStudyField } from '../../logic/valley-study';
import type { ChapterStageFactory } from '../chapter-stage';
import { createSandboxStage, type StageContext } from '../sandbox';
import { valleyGeometry } from './geometry';
import { valleyMaterial } from './material';
import { plateEdge } from './plate-edge';
import { sceneSwatch } from '../scene-palette';

type ValleyContextView = Readonly<{
	exaggeration: number;
	elevationRad: number;
	margin: number;
	heightRangeM: readonly [number, number];
}>;

type Plate = Readonly<{ x: number; y: number; width: number }>;

function valleyMeshes(fields: readonly ValleyField[], exaggeration: number) {
	const group = new Group();
	const { material, setPalette, reveal } = valleyMaterial(exaggeration);
	const meshes = fields.map((field) => new Mesh(valleyGeometry(field, exaggeration), material));
	group.add(...meshes);
	return {
		group,
		meshes,
		reveal,
		setPalette,
		dispose(this: void) {
			for (const mesh of meshes) mesh.geometry.dispose();
			material.dispose();
		}
	};
}

/** Builds a shared-stage context for projected valley fields at one orientation and scale. */
export function createValleyContext(fields: readonly ValleyField[], view: ValleyContextView) {
	const { group, meshes, setPalette, dispose } = valleyMeshes(fields, view.exaggeration);
	const bounds = new Box3();

	const elevationSin = Math.sin(view.elevationRad);
	const [low, high] = view.heightRangeM;
	const datum = ((low + high) / 2) * view.exaggeration;
	const windowM = fields[0].windowM * view.margin;

	const context: StageContext = {
		group,
		bounds,
		orientation: { headingRad: 0, elevationRad: view.elevationRad },
		setPalette,
		dispose
	};

	return {
		context,
		/** Fits the orthographic frame to the deck and centers terrain under each plate, in CSS pixels. */
		layout(width: number, height: number, plates: readonly Plate[]) {
			const scale = windowM / plates[0].width;
			const depthScale = scale / elevationSin;
			const halfWidth = (width * scale) / 2;
			const halfDepth = (height * depthScale) / 2;
			bounds.min.set(-halfWidth, 0, -halfDepth);
			bounds.max.set(halfWidth, 0, halfDepth);
			meshes.forEach((mesh, index) => {
				const { x, y } = plates[index];
				mesh.position.set((x - width / 2) * scale, -datum, (y - height / 2) * depthScale);
			});
		}
	};
}

/** Creates a fixed-context valley viewer from the same fields and mesh as the sandbox study. */
export const createValleyChapterStage: ChapterStageFactory = (canvas, onError) => {
	const fields = VALLEY_PICTURE_SEEDS.map(valleyStudyField);
	const { exaggeration } = VALLEY_STUDY_VIEW;
	const { group, meshes, reveal, setPalette, dispose } = valleyMeshes(fields, exaggeration);
	const bounds = new Box3().setFromObject(group);
	const baseDepthM = 20;
	const baseY = bounds.min.y - baseDepthM;
	bounds.min.y = baseY;
	const edgeMaterial = new MeshBasicMaterial({ toneMapped: false });
	const edges = meshes.map((mesh) => {
		const surface = mesh.geometry.getAttribute('position') as BufferAttribute;
		const edge = new Mesh(plateEdge(surface, baseY), edgeMaterial);
		mesh.add(edge);
		return edge;
	});

	const terrain = { headingRad: 0, elevationRad: (65 * Math.PI) / 180 };
	const stage = createSandboxStage(canvas, onError, {
		context: {
			group,
			bounds,
			orientation: terrain,
			viewOrientations: {
				terrain,
				iso: { headingRad: Math.PI / 4, elevationRad: Math.atan(Math.SQRT1_2) },
				plan: { headingRad: 0, elevationRad: Math.PI / 2 }
			},
			viewMargin: 1.12,
			setPalette(palette) {
				setPalette(palette);
				edgeMaterial.color
					.set(sceneSwatch(palette, '--ground-stone'))
					.lerp(new Color(palette.paper), 0.25);
			},
			dispose() {
				for (const edge of edges) edge.geometry.dispose();
				edgeMaterial.dispose();
				dispose();
			}
		}
	});
	void stage.ready.catch(() => {});

	return {
		show({ seed }) {
			meshes.forEach((mesh, index) => (mesh.visible = fields[index].seed === seed));
			stage.render();
		},
		reveal(phase) {
			reveal(phase);
			stage.render();
		},
		setView: stage.setView,
		resize: stage.resize,
		dispose: stage.dispose
	};
};
