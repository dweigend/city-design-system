import {
	attribute,
	cameraProjectionMatrix,
	materialLineWidth,
	modelViewMatrix,
	positionGeometry,
	screenDPR,
	uniform,
	vec2,
	vec3,
	vec4,
	viewportSize
} from 'three/tsl';
import type { Line2NodeMaterial } from 'three/webgpu';

export function stretchStroke(material: Line2NodeMaterial) {
	const stretch = uniform(0);
	const pivot = uniform(0);
	const project = (name: string) => {
		const point = attribute(name, 'vec3');
		const z = point.z.add(point.z.sub(pivot).max(0).mul(stretch));
		return cameraProjectionMatrix.mul(modelViewMatrix.mul(vec4(vec3(point.xy, z), 1)));
	};
	const start = project('instanceStart');
	const end = project('instanceEnd');
	// The stage is orthographic. Expand the projected segment in CSS pixels.
	const delta = end.xy.sub(start.xy).mul(viewportSize);
	const along = delta.div(delta.length().max(1e-6));
	const across = vec2(along.y, along.x.negate());
	const cap = positionGeometry.y.clamp(0, 1);
	const offset = across
		.mul(positionGeometry.x)
		.add(along.mul(positionGeometry.y.sub(cap)))
		.mul(materialLineWidth.mul(screenDPR))
		.div(viewportSize);
	const point = positionGeometry.y.lessThan(0.5).select(start, end);
	material.vertexNode = point.add(vec4(offset, 0, 0));
	return { stretch, pivot };
}
