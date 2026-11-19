import { screenSize, uv, vec2 } from 'three/tsl';
import type { TextureNode } from 'three/webgpu';

/** One foreground pixel on an orthographic depth break. Opposite samples cancel planar slopes. */
export function cityEdge(depth: TextureNode, depthRangeM: number) {
	const pixel = vec2(1).div(screenSize);
	const center = depth.sample(uv()).r;
	const jump = (offset: typeof pixel) =>
		depth
			.sample(uv().add(offset))
			.r.add(depth.sample(uv().sub(offset)).r)
			.sub(center.mul(2));
	const gap = jump(vec2(pixel.x, 0))
		.max(jump(vec2(0, pixel.y)))
		.mul(depthRangeM);
	return gap.smoothstep(0.18, 0.95).mul(0.42);
}
