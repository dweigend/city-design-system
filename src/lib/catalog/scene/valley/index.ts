import { Box3, Group, Mesh } from 'three/webgpu';
import type { ValleyField } from '../../logic/valley';
import { VALLEY_PICTURE_SEEDS } from '../../data/valley-references';
import { VALLEY_STUDY_VIEW, valleyStudyField } from '../../logic/valley-study';
import type { ChapterStageFactory } from '../chapter-stage';
import { createSandboxStage, type StageContext } from '../sandbox';
import { valleyGeometry } from './geometry';
import { valleyMaterial } from './material';

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
	const { exaggeration, elevationRad, margin, heightRangeM } = VALLEY_STUDY_VIEW;
	const { group, meshes, reveal, setPalette, dispose } = valleyMeshes(fields, exaggeration);
	const half = fields[0].windowM / 2;
	const bounds = new Box3();
	bounds.min.set(-half, heightRangeM[0] * exaggeration, -half);
	bounds.max.set(half, heightRangeM[1] * exaggeration, half);

	const terrain = { headingRad: 0, elevationRad };
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
			viewMargin: margin,
			setPalette,
			dispose
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
