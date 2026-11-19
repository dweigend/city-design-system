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
	atan,
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

/** Angular 20–40 cm aggregate on printed panels. Reveal chips only at house scale. */
export function terrazzo(paper: Node<'color'>, scale: Node<'float'>) {
	const material = new MeshBasicNodeMaterial();
	const base = attribute('color', 'vec3'),
		p = positionLocal;
	// A 1.25 m cell holds a single rotated shard. Keep the largest shard inside its cell.
	const cellsPerMeter = 0.8;
	const plane = normalWorld.y
		.abs()
		.greaterThan(0.65)
		.select(p.xz, vec2(normalWorld.x.abs().greaterThan(normalWorld.z.abs()).select(p.z, p.x), p.y));
	const uv = plane.mul(cellsPerMeter);
	const cell = uv.floor();
	const seed = cell.dot(vec2(0.7548777, 0.5698403)).fract();
	const noise = seed.mul(31.47).fract();
	const q = uv
		.fract()
		.sub(0.5)
		.sub(vec2(noise, seed.mul(71.63).fract()).sub(0.5).mul(0.66));
	const sides = seed.mul(3).floor().add(3),
		sector = float(2 * Math.PI).div(sides);
	const theta = atan(q.y, q.x).add(noise.mul(2 * Math.PI));
	const edge = theta.div(sector).add(0.5).fract().sub(0.5).mul(sector).cos().mul(q.length());
	const radius = seed.mul(0.1).add(0.1).mul(cellsPerMeter).mul(sector.mul(0.5).cos());
	const aa = uv.fwidth().length().mul(0.42).max(0.0001);
	const density = float(1).sub(edge.smoothstep(radius.sub(aa), radius.add(aa)));
	const chip = mix(paper, attribute('chipColor', 'vec3'), float(seed.greaterThan(0.51)));
	material.colorNode = mix(
		base,
		chip,
		density.mul(scale.smoothstep(MASSSTAB.quartier, MASSSTAB.haus))
	);
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
