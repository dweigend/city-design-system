import type { Node } from 'three/webgpu';
import { color, mix, normalWorldGeometry } from 'three/tsl';

/** Warm model paper; soft plane shading leaves the actual roof and wall creases to pencil lines. */
export function pencilStock(paper: Node<'vec3'>, graphite: Node<'vec3'>) {
	const stock = paper.mul(color('#ece8e0'));
	const flank = normalWorldGeometry.x.sub(normalWorldGeometry.z.mul(0.3)).smoothstep(-0.4, 0.85);
	return mix(stock, graphite, flank.mul(normalWorldGeometry.y.abs().oneMinus()).mul(0.13));
}
