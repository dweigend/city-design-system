import { attribute, float, mix, normalWorld, positionLocal, vec2, vec3 } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

/** Slip-cast glaze with a broad kiln band and angular inclusions measured in model metres. */
export function firedSlip() {
	const material = new MeshBasicNodeMaterial();
	const pigment = attribute('color', 'vec3');
	const p = positionLocal;
	// An oblique slice through the fired body keeps the grain continuous across its facets.
	const uv = vec2(p.x.add(p.z.mul(0.57)), p.y.add(p.z.mul(0.84))).mul(3.1);
	const cell = uv.floor();
	const offset = cell.dot(vec2(0.7548777, 0.5698403)).fract();
	const q = uv.fract().sub(0.5);
	const cut = q.x.abs().add(q.y.add(q.x.mul(offset)).abs().mul(1.6));
	const feather = uv.fwidth().length().max(0.001);
	const chips = float(1)
		.sub(cut.smoothstep(0.18, feather.add(0.18)))
		.mul(offset.smoothstep(0.36, 0.72))
		.mul(float(1).sub(feather.smoothstep(0.18, 0.58)));
	const face = normalWorld.dot(vec3(0.38, 0.82, 0.42)).add(p.y.mul(1.4).sin().mul(0.04));
	const lip = face.smoothstep(0.4, 0.47).sub(face.smoothstep(0.63, 0.71));
	const body = pigment.mul(face.smoothstep(-0.5, 0.72).mul(0.22).add(0.75));
	material.colorNode = mix(body, vec3(1), lip.mul(0.37)).mul(float(1).sub(chips.mul(0.38)));
	return material;
}
