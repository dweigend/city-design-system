import type { Node } from 'three/webgpu';
import { float, mix, normalWorldGeometry, positionLocal } from 'three/tsl';

/** Graphite strokes in object-local metres. Unresolved strokes fade into the paper at city scale. */
export function pencilStock(paper: Node<'vec3'>, graphite: Node<'vec3'>) {
	const phase = positionLocal.x
		.add(positionLocal.z.mul(0.62))
		.add(positionLocal.y.mul(0.68))
		.mul(2.1);
	const footprint = phase.fwidth().max(0.001);
	const stroke = phase.fract().sub(0.5).abs().div(footprint).smoothstep(0, 0.72).oneMinus();
	const flank = normalWorldGeometry.x.sub(normalWorldGeometry.z.mul(0.3)).smoothstep(-0.25, 0.85);
	const slope = float(1).sub(normalWorldGeometry.y.abs());
	const ink = stroke.mul(footprint.smoothstep(0.2, 0.6).oneMinus()).mul(0.42).add(0.065);
	return mix(paper, graphite, ink.mul(slope).mul(flank).add(slope.mul(0.08)).add(0.065));
}
