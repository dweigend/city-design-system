import { Box3, Group, Mesh } from 'three/webgpu';
import type { ValleyField } from '../../logic/valley';
import type { StageContext } from '../sandbox';
import { valleyGeometry } from './geometry';
import { valleyMaterial } from './material';

type ValleyContextView = Readonly<{
	exaggeration: number;
	elevationRad: number;
	margin: number;
	heightRangeM: readonly [number, number];
}>;

type Plate = Readonly<{ x: number; y: number; width: number }>;

/** Builds a shared-stage context for projected valley fields at one orientation and scale. */
export function createValleyContext(fields: readonly ValleyField[], view: ValleyContextView) {
	const group = new Group();
	const bounds = new Box3();
	const { material, setPalette } = valleyMaterial(view.exaggeration);
	const meshes = fields.map(
		(field) => new Mesh(valleyGeometry(field, view.exaggeration), material)
	);
	group.add(...meshes);

	const elevationSin = Math.sin(view.elevationRad);
	const [low, high] = view.heightRangeM;
	const datum = ((low + high) / 2) * view.exaggeration;
	const windowM = fields[0].windowM * view.margin;

	const context: StageContext = {
		group,
		bounds,
		orientation: { headingRad: 0, elevationRad: view.elevationRad },
		setPalette,
		dispose() {
			for (const mesh of meshes) mesh.geometry.dispose();
			material.dispose();
		}
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
