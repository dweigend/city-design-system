import { attribute, float, mix } from 'three/tsl';
import { Float32BufferAttribute, MeshBasicNodeMaterial, type Node } from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import { batch, type Batch } from '../batch';
import { travellingDash } from './water-print';
import type { Color } from 'three/webgpu';

type Pipe = Extract<Primitive, { kind: 'pipe' }>;

/** Survey each baked vertex against the closest pipe span once, retaining distance through elbows. */
function stations(pipe: Pipe, positions: number[]) {
	const path = pipe.points;
	const spans = path.slice(1).map((b, i) => {
		const a = path[i],
			dx = b[0] - a[0],
			dy = b[1] - a[1],
			dz = b[2] - a[2];
		return { a, dx, dy, dz, len: Math.hypot(dx, dy, dz) };
	});
	const coordinates: number[] = [];
	for (let i = 0; i < positions.length; i += 3) {
		let at = 0,
			best = Infinity,
			start = 0;
		for (const { a, dx, dy, dz, len } of spans) {
			const x = positions[i] - a[0],
				y = -positions[i + 2] - a[1],
				z = positions[i + 1] - a[2];
			const t = Math.min(1, Math.max(0, (x * dx + y * dy + z * dz) / (len * len || 1)));
			const d = (x - dx * t) ** 2 + (y - dy * t) ** 2 + (z - dz * t) ** 2;
			if (d < best) {
				at = start + t * len;
				best = d;
			}
			start += len;
		}
		coordinates.push(at);
	}
	return coordinates;
}

/** Joins the conduits into one draw call with continuous world-metre stationing. */
export function conduitBatch(parts: Primitive[], tone: (p: Primitive) => Color) {
	const pieces = parts
		.filter((p): p is Pipe => p.kind === 'pipe')
		.map((p) => {
			const baked = batch([p], tone);
			const faces = p.glass ? baked.glas : baked.neu;
			return { faces, axis: stations(p, faces.p) };
		});
	const faces: Batch['neu'] = {
		p: pieces.flatMap((p) => p.faces.p),
		n: pieces.flatMap((p) => p.faces.n),
		c: pieces.flatMap((p) => p.faces.c)
	};
	return {
		faces,
		axis: new Float32BufferAttribute(
			pieces.flatMap((p) => p.axis),
			1
		)
	};
}

/** Paper dashes travel down the coloured service pipe at the river print's cadence. */
export function conduitInk(seconds: Node<'float'>, paper: Node<'color'>) {
	const material = new MeshBasicNodeMaterial();
	const axis = attribute('stationM', 'float');
	const coverage = travellingDash(axis, seconds).mul(
		float(1).sub(axis.fwidth().smoothstep(0.5, 1.5))
	);
	material.colorNode = mix(attribute('color', 'vec3'), paper, coverage.mul(0.76));
	return material;
}
