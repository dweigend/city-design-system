import type { Node } from 'three/webgpu';
import {
	float,
	mix,
	mx_noise_float,
	mx_worley_noise_float,
	Fn,
	attribute,
	modelWorldMatrix,
	normalWorldGeometry,
	vec4,
	sin,
	vec3
} from 'three/tsl';

import { grainVisibility } from './pattern-density';
import type { MusterRaum } from './materialMuster';

const saatVektor = vec3(7.31, 2.19, 5.73);

function wachstum(p: Node<'vec3'>, aufrecht: boolean, pitch: number) {
	const drift = mx_noise_float(p.mul(vec3(0.58, 1.4, 1.4)).add(saatVektor));
	// The upright study cuts off-center stock, giving long grain across the exposed walls.
	const mark = aufrecht ? vec3(-1.61, -1.82, 0) : vec3(0.31, -0.47, 0);
	const radius = p.yz
		.sub(mark.xy)
		.mul(vec3(1, 1.28, 1).xy)
		.length();
	// Elongated cellular centers pull the local rings around branch knots.
	const astAbstand = mx_worley_noise_float(p.mul(vec3(0.46, 1.88, 1.74)).add(saatVektor));
	const ast = float(1).sub(astAbstand.smoothstep(0.035, 0.38));
	const phase = radius
		.mul((2 * Math.PI) / pitch)
		.add(drift.mul(5.5))
		.add(ast.mul(2.75));
	return { ring: sin(phase).mul(0.5).add(0.5).smoothstep(0.39, 0.96), ast };
}

/** Projects long fibers and cut rings from a shared 3D grain in meters. Upright stock runs up Y. */
export function holzMuster(base: Node<'vec3'>, aufrecht: boolean, raum: MusterRaum) {
	const axis = Fn((builder) => {
		const local = builder.geometry.hasAttribute('grainAxis')
			? attribute('grainAxis', 'vec3')
			: vec3(1, 0, 0);
		return modelWorldMatrix.mul(vec4(local, 0)).xyz.normalize();
	})();
	const up = axis.y
		.abs()
		.greaterThan(0.9)
		.select(vec3(0, 0, 1), vec3(0, 1, 0));
	const across = axis.cross(up).normalize();
	const p = aufrecht
		? raum.welt.yxz
		: vec3(
				raum.welt.dot(axis),
				raum.welt.dot(up.sub(axis.mul(up.dot(axis))).normalize()),
				raum.welt.dot(across)
			);
	const end = (aufrecht ? normalWorldGeometry.y : normalWorldGeometry.dot(axis))
		.abs()
		.smoothstep(0.57, 0.92);
	const pitch = aufrecht ? 0.065 : 0.05;
	const { ring, ast } = wachstum(p, aufrecht, pitch);
	const visible = grainVisibility(p.div(vec3(0.25, pitch, pitch)));
	const grain = ring
		.sub(0.5)
		.mul(mix(0.12, 0.16, end))
		.add(ast.mul(0.02))
		.mul(visible);
	const cut = mix(vec3(1), vec3(0.97, 0.96, 0.94), end);
	return {
		farbe: base.mul(cut).mul(grain.oneMinus()),
		hoehe: ring.mul(-0.14).sub(ast.mul(0.02)),
		relief: 0.001
	};
}
