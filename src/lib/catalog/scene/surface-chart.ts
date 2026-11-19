import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three/webgpu';

/** Attaches metre coordinates and a continuous UV fallback before any transform or merge. */
export function chartSurface(g: BufferGeometry) {
	g.computeBoundingBox();
	const bounds = g.boundingBox!;
	const size = bounds.getSize(new Vector3());
	const pos = g.getAttribute('position');
	const uv = [];
	const chart = new Float32Array(pos.count * 4);
	for (let i = 0; i < pos.count; i++) {
		const x = (pos.getX(i) - bounds.min.x) / (size.x || 1);
		const y = (pos.getY(i) - bounds.min.y) / (size.y || 1);
		const z = (pos.getZ(i) - bounds.min.z) / (size.z || 1);
		chart.set(
			[pos.getX(i) - bounds.min.x, pos.getY(i) - bounds.min.y, pos.getZ(i) - bounds.min.z, y],
			4 * i
		);
		uv.push((x + 0.39 * z) / 1.39, (y + 0.81 * z) / 1.81);
	}
	g.setAttribute('finishChart', new Float32BufferAttribute(chart, 4));
	g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
}
