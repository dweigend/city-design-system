import type { Primitive } from '../logic/parametrik/types';
import { creaseChart, modelBevel } from './convex-creases';
import { Box3, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three/webgpu';

/** Attaches metre coordinates and a continuous UV fallback before any transform or merge. */
export function chartSurface(g: BufferGeometry, kind: Primitive['kind'], rotation = 0) {
	g.computeBoundingBox();
	const bounds = g.boundingBox ?? new Box3();
	const size = bounds.getSize(new Vector3());
	const angular = ['wedge', 'prism', 'mesh'].includes(kind);
	const radius = modelBevel(Math.min(size.x, size.y, size.z), Math.max(size.x, size.y, size.z));
	creaseChart(g, angular && !g.index ? radius : 0);
	const pos = g.getAttribute('position');
	const axis = new Vector3(Number(size.x >= size.y && size.x >= size.z), 0, 0);
	if (!axis.x) axis.set(0, Number(size.y >= size.z), Number(size.z > size.y));
	axis.applyAxisAngle(new Vector3(0, 1, 0), rotation);
	const grainAxis = new Float32Array(pos.count * 3);
	const uv = [];
	const chart = new Float32Array(pos.count * 4);
	for (let i = 0; i < pos.count; i++) {
		axis.toArray(grainAxis, i * 3);
		const x = (pos.getX(i) - bounds.min.x) / (size.x || 1);
		const y = (pos.getY(i) - bounds.min.y) / (size.y || 1);
		const z = (pos.getZ(i) - bounds.min.z) / (size.z || 1);
		chart.set(
			[pos.getX(i) - bounds.min.x, pos.getY(i) - bounds.min.y, pos.getZ(i) - bounds.min.z, y],
			4 * i
		);
		uv.push((x + 0.39 * z) / 1.39, (y + 0.81 * z) / 1.81);
	}
	g.setAttribute('grainAxis', new Float32BufferAttribute(grainAxis, 3));
	g.setAttribute('finishChart', new Float32BufferAttribute(chart, 4));
	g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
}
