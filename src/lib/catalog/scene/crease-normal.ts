import type { Node } from 'three/webgpu';
import { Fn, attribute, normalView, positionView } from 'three/tsl';

/** Bends a physical normal toward convex folds within their metre-scaled bevel band. */
export function creaseNormal(surface: Node<'vec3'>) {
	return Fn((builder) => {
		if (!builder.geometry.hasAttribute('creaseDistance')) return surface;
		const chart = attribute('creaseDistance', 'vec4');
		const d = chart.x.min(chart.y).min(chart.z.min(chart.w));
		const x = positionView.dFdx(),
			y = positionView.dFdy();
		const tangent = y.cross(normalView);
		const gradient = tangent
			.mul(d.dFdx())
			.add(normalView.cross(x).mul(d.dFdy()))
			.mul(x.dot(tangent).sign());
		const outward = gradient.div(gradient.length().max(1e-10)).negate();
		const resolved = d.fwidth().smoothstep(0.7, 2).oneMinus();
		return surface.add(outward.mul(d.clamp(0, 1).oneMinus().mul(resolved).mul(0.72))).normalize();
	})();
}
