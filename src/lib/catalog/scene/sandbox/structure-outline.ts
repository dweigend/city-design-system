import { InstancedBufferAttribute, type Node } from 'three/webgpu';
import {
	attribute,
	cameraProjectionMatrix,
	positionView,
	screenDPR,
	screenSize,
	vec4
} from 'three/tsl';

const DIRECTIONS = 12;

/** Expansion needed for a polygonal pixel kernel to cover the required width in any direction. */
export const outlineExpansion = 1 / Math.cos(Math.PI / DIRECTIONS);

/** Translations of the body in screen space, independent of its face normals and camera. */
export const outlineOffsets = new InstancedBufferAttribute(
	new Float32Array(
		Array.from({ length: DIRECTIONS }, (_, i) => {
			const angle = (2 * Math.PI * i) / DIRECTIONS;
			return [Math.cos(angle), Math.sin(angle)];
		}).flat()
	),
	2
);

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
