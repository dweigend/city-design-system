import { Float32BufferAttribute, type Color } from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import { batch, type Batch } from '../batch';

function shellChart(part: Primitive, coords: number[], coloured: boolean) {
	let cx = 0,
		cy = 0,
		cz = 0,
		dx = 1,
		dz = 0,
		radius = 1,
		half = 1;
	if (part.kind === 'capsule') {
		const { from: a, to: b } = part;
		cx = (a[0] + b[0]) / 2;
		cy = (a[2] + b[2]) / 2;
		cz = -(a[1] + b[1]) / 2;
		const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
		if (span) {
			dx = (b[0] - a[0]) / span;
			dz = (a[1] - b[1]) / span;
		}
		radius = part.radius;
		half = radius + span / 2;
	} else if ('position' in part) {
		[cx, cz, cy] = part.position;
		cz = -cz;
		if (part.kind === 'box') {
			cx += part.size[0] / 2;
			cz -= part.size[1] / 2;
			cy += part.size[2] / 2;
			radius = part.size[2] / 2;
			half = part.size[0] / 2;
		} else if ('radius' in part) {
			half = radius = part.radius;
		}
	}
	const family = !coloured ? 0 : part.kind === 'sphere' ? 2 : part.kind === 'torus' ? 3 : 1;
	const chart: number[] = [];
	for (let i = 0; i < coords.length; i += 3) {
		const x = coords[i] - cx,
			z = coords[i + 2] - cz;
		chart.push(
			(x * dx + z * dz) / half,
			(coords[i + 1] - cy) / radius,
			(z * dx - x * dz) / radius,
			family
		);
	}
	return chart;
}

/** Bakes the dip coordinates of each casting before joining it to the ceramic draw call.
 * Only a shell with its own functional fitting inherits that fitting's pigment. */
export function ceramicBatch(
	parts: Primitive[],
	pigments: ReadonlyMap<string, Primitive>,
	tone: (p: Primitive) => Color
) {
	const pieces = parts.map((part) => {
		const accent = pigments.get(part.id) ?? part;
		const faces = batch([part], () => tone(accent));
		return { faces, chart: shellChart(part, faces.neu.p, accent.token !== '--paper') };
	});
	const faces: Batch['neu'] = {
		p: pieces.flatMap((p) => p.faces.neu.p),
		n: pieces.flatMap((p) => p.faces.neu.n),
		c: pieces.flatMap((p) => p.faces.neu.c)
	};
	return {
		faces,
		edges: pieces.flatMap((p) => p.faces.kanten.neu),
		chart: new Float32BufferAttribute(
			pieces.flatMap((p) => p.chart),
			4
		)
	};
}
