import { studioKeyDirection } from './studio-light';
import { atan, float, mix, normalWorld, normalView, vec3 } from 'three/tsl';
import { MeshBasicNodeMaterial, type Node } from 'three/webgpu';

/** A matte clay body, one dipped cap, its pooled lip and a paper-white reflected shape. */
export function firedSlip(
	clay: Node<'color'>,
	shade: Node<'color'>,
	seconds: Node<'float'>,
	contour: Node<'color'>,
	night: Node<'float'>,
	pigment: Node<'vec3'>,
	q: Node<'vec4'>
) {
	const material = new MeshBasicNodeMaterial();
	const tank = q.w.equal(2),
		ring = q.w.equal(3);
	const level = tank.select(q.y.negate().add(seconds.mul(0.58).sin().mul(0.76)).add(0.28), q.x);
	const rim = level.add(q.y.mul(7).add(q.z.mul(3)).sin().mul(0.033));
	const feather = rim.fwidth().max(0.002);
	const dip = rim.smoothstep(float(0.1).sub(feather), float(0.1).add(feather));
	const cap = ring.select(float(1), dip).mul(float(q.w.greaterThan(0)));
	const lip = float(1).sub(rim.sub(0.12).abs().smoothstep(0.018, feather.add(0.048)));
	const face = normalWorld.dot(vec3(studioKeyDirection));
	const body = face.greaterThanEqual(0.17).select(clay, shade);
	// An asymmetric painted sector makes a ten-second revolution readable on the circular rim.
	const turn = atan(q.z, q.x)
		.div(2 * Math.PI)
		.sub(seconds.div(10))
		.fract();
	const panel = turn.lessThan(0.22);
	const stripe = turn.greaterThan(0.26).and(turn.lessThan(0.3));
	const ringInk = panel.select(pigment.mul(0.48), stripe.select(clay.rgb, pigment));
	const u = normalView.x.add(0.12);
	const bow = normalView.y.sub(0.72).add(u.mul(u).mul(0.38));
	const stroke = u
		.mul(u)
		.div(0.4356)
		.add(bow.div(0.115).mul(bow.div(0.115)));
	const fixedFlash = float(1).sub(stroke.smoothstep(0.85, 1.15));
	const glaze = mix(pigment.mul(float(1).sub(lip.mul(0.37))), clay, fixedFlash.mul(0.92));
	const rimInk = float(1).sub(
		normalView.z.abs().smoothstep(0.06, normalView.z.fwidth().max(0.03).add(0.12))
	);
	material.colorNode = mix(mix(body, ring.select(ringInk, glaze), cap), contour, rimInk.mul(night));
	return material;
}
