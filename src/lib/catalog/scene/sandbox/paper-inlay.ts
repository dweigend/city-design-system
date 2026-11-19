import {
	MeshBasicNodeMaterial,
	InstancedBufferAttribute,
	InstancedBufferGeometry,
	Mesh,
	type BufferGeometry,
	type Material,
	type Node
} from 'three/webgpu';
import {
	attribute,
	cameraProjectionMatrix,
	float,
	mix,
	positionView,
	screenDPR,
	screenSize,
	vec4
} from 'three/tsl';

/** A guillotined paper edge and a single hard shadow, in CSS pixels. */
const cutOffsets = new InstancedBufferAttribute(new Float32Array([0.65, -0.65, -0.45, 0.45]), 2);

/** Moves a paper shadow by a fixed CSS-pixel distance under either renderer backend. */
export function shiftedPaper(offset: Node<'vec2'>) {
	const clip = cameraProjectionMatrix.mul(vec4(positionView, 1));
	return vec4(clip.xy.add(offset.mul(screenDPR).mul(2).div(screenSize).mul(clip.w)), clip.zw);
}

/** Offset copies sit behind their parent sheet so neighbouring architecture still occludes them. */
export function cutPaper(paper: Node<'color'>, shadow: Node<'color'>) {
	const material = new MeshBasicNodeMaterial({
		depthWrite: false,
		polygonOffset: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1
	});
	const offset = attribute('cutOffset', 'vec2');
	material.vertexNode = shiftedPaper(offset);
	material.colorNode = mix(paper, shadow, float(offset.x.greaterThan(0)));
	return material;
}

/** Two instances share the source vertices and register the light cut and dark offset in screen space. */
export function paperEdge(source: BufferGeometry, material: Material) {
	const backing = new InstancedBufferGeometry();
	backing.setAttribute('position', source.getAttribute('position'));
	backing.setAttribute('cutOffset', cutOffsets);
	backing.instanceCount = cutOffsets.count;
	const edge = new Mesh(backing, material);
	edge.renderOrder = -1;
	return edge;
}
