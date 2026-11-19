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
	normalWorld,
	positionLocal,
	positionView,
	screenDPR,
	screenSize,
	vec2,
	vec4
} from 'three/tsl';
import { MASSSTAB } from '../../data/leitstil';

/** A guillotined paper edge and a single hard shadow, in CSS pixels. */
const cutOffsets = new InstancedBufferAttribute(new Float32Array([1.5, -1.4, -0.55, 0.5]), 2);

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

/** Angular 5–15 cm aggregate in step-two pigment. Reveal chips only at house scale. */
export function terrazzo(paper: Node<'color'>, scale: Node<'float'>) {
	const material = new MeshBasicNodeMaterial();
	const base = attribute('color', 'vec3'),
		p = positionLocal;
	const uv = vec2(p.x.add(p.y.mul(0.48)), p.z.add(p.y.mul(0.83))).mul(2.7);
	const seed = uv.floor().dot(vec2(0.7548777, 0.5698403)).fract();
	const jitter = vec2(seed, seed.mul(17.93).fract()).sub(0.5).mul(0.56);
	const q = uv.fract().sub(0.5).sub(jitter);
	const cut = q.x
		.abs()
		.mul(0.7)
		.add(q.y.add(q.x.mul(seed.sub(0.5))).abs());
	const radius = seed.mul(0.12).add(0.07);
	const aa = uv.fwidth().length().max(0.001).mul(0.5);
	const density = float(1).sub(cut.smoothstep(radius.sub(aa), radius.add(aa)));
	const chip = mix(paper, attribute('chipColor', 'vec3'), float(seed.greaterThan(0.51)));
	material.colorNode = mix(
		base,
		chip,
		density.mul(scale.smoothstep(MASSSTAB.quartier, MASSSTAB.haus))
	).mul(normalWorld.y.max(0).mul(0.13).add(0.87));
	return material;
}

/** Two instances share the source vertices and register the light cut and dark offset in screen space. */
export function paperEdge(source: BufferGeometry, material: Material) {
	const backing = new InstancedBufferGeometry();
	backing.setAttribute('position', source.getAttribute('position'));
	backing.setAttribute('cutOffset', cutOffsets);
	backing.instanceCount = cutOffsets.count;
	const edge = new Mesh(backing, material);
	edge.renderOrder = 1;
	return edge;
}
