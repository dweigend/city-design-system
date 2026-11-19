import {
	BackSide,
	BufferGeometry,
	type Color,
	InstancedBufferGeometry,
	InstancedBufferAttribute,
	Material,
	Mesh,
	MeshBasicNodeMaterial,
	type Node
} from 'three/webgpu';
import {
	attribute,
	cameraProjectionMatrix,
	float,
	positionView,
	screenDPR,
	screenSize,
	vec4
} from 'three/tsl';

const DIRECTIONS = 12;

/** Expansion needed for a polygonal pixel kernel to cover the required width in any direction. */
export const outlineExpansion = 1 / Math.cos(Math.PI / DIRECTIONS);

/** Translations of the body in screen space, independent of its face normals and camera. */
const outlineOffsets = new InstancedBufferAttribute(
	new Float32Array(
		Array.from({ length: DIRECTIONS }, (_, i) => {
			const angle = (2 * Math.PI * i) / DIRECTIONS;
			return [Math.cos(angle), Math.sin(angle)];
		}).flat()
	),
	2
);

/** Identifies the ceramic finishes with a continuous ink contour. */
export function hasGlazeContour(finish: string | undefined) {
	return finish === 'keramik-glasiert' || finish === 'glaze';
}

export type GlazeContour = { ink: Color; material?: MeshBasicNodeMaterial };
const glazeContourPosition = outlinePositionAtOffset(float(1.1));

/** Caches the 1.1 CSS px glaze contour per scene. Mutating its live ink refreshes the palette. */
export function glazeContourMaterial(contour: GlazeContour): MeshBasicNodeMaterial {
	if (!contour.material) {
		const material = new MeshBasicNodeMaterial({ side: BackSide });
		material.color = contour.ink;
		material.vertexNode = glazeContourPosition;
		contour.material = material;
	}
	return contour.material;
}

/** Creates a screen-space contour sharing the face positions. Caller owns the returned geometry. */
export function silhouette(source: BufferGeometry, material: Material) {
	const geometry = new InstancedBufferGeometry();
	geometry.setAttribute('position', source.getAttribute('position'));
	geometry.setIndex(source.index);
	if (source.userData.outlineVertices !== undefined)
		geometry.setDrawRange(0, source.userData.outlineVertices);
	geometry.setAttribute('outlineOffset', outlineOffsets);
	geometry.instanceCount = outlineOffsets.count;
	return new Mesh(geometry, material);
}

/** Projects an outline copy, with optional depth separation for double-sided geometry. */
export function outlinePositionAtOffset(
	thicknessPx: Node<'float'>,
	depthM: number | Node<'float'> = 0
) {
	const clip = cameraProjectionMatrix.mul(vec4(positionView.xy, positionView.z.sub(depthM), 1));
	const offset = attribute('outlineOffset', 'vec2')
		.mul(thicknessPx)
		.mul(screenDPR)
		.mul(2)
		.div(screenSize);
	return vec4(clip.xy.add(offset.mul(clip.w)), clip.zw);
}
