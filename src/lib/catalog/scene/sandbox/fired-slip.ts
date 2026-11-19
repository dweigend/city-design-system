import { attribute, float, mix, normalWorld, vec3 } from 'three/tsl';
import { MeshBasicNodeMaterial, type Node } from 'three/webgpu';

/** A matte clay body, one dipped cap, its pooled lip and a paper-white reflected shape. */
export function firedSlip(clay: Node<'color'>, shade: Node<'color'>, seconds: Node<'float'>) {
	const material = new MeshBasicNodeMaterial();
	const pigment = attribute('color', 'vec3'),
		q = attribute('kilnChart', 'vec4');
	const tank = q.w.equal(2),
		ring = q.w.equal(3);
	const level = tank.select(q.y.add(seconds.mul(0.8).sin().mul(0.13)), q.x);
	const rim = level.add(q.y.mul(7).add(q.z.mul(3)).sin().mul(0.033));
	const feather = rim.fwidth().max(0.002);
	const dip = rim.smoothstep(float(0.1).sub(feather), float(0.1).add(feather));
	const cap = ring.select(float(1), dip).mul(float(q.w.greaterThan(0)));
	const lip = float(1).sub(rim.sub(0.12).abs().smoothstep(0.018, feather.add(0.048)));
	const face = normalWorld.dot(vec3(-0.42, 0.82, 0.38));
	const body = mix(shade, clay, face.smoothstep(0.17, face.fwidth().max(0.001).add(0.17)));
	const turning = q.x
		.mul(seconds.mul(0.24).cos())
		.add(q.z.mul(seconds.mul(0.24).sin()))
		.smoothstep(0.89, 0.94);
	const fixedFlash = normalWorld.dot(vec3(0.42, 0.75, 0.51)).smoothstep(0.921, 0.937);
	const flash = ring.select(turning, fixedFlash);
	const glaze = mix(pigment.mul(float(1).sub(lip.mul(0.37))), clay, flash.mul(0.92));
	material.colorNode = mix(body, glaze, cap);
	return material;
}
