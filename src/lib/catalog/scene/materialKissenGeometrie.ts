/** Membrane envelope and seam profiles: the legacy shallow pillow and the four-lobed `kreuz`. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StudienProfil } from '../logic/material/formen';
import { polsterGeometrie, polsterNahtGeometrie } from './materialPolsterGeometrie';

type Membran = Extract<StudienProfil, { art: 'kissen' | 'naht' }>;

function kissenHoehe(u: number, v: number, h: number, top: boolean): number {
	const bulge = Math.pow(
		Math.max(0, Math.cos((u * Math.PI) / 2) * Math.cos((v * Math.PI) / 2)),
		0.65
	);
	return h * (top ? 0.16 + 0.81 * bulge : 0.16 * (1 - bulge));
}

function kissen(w: number, d: number, h: number): THREE.BufferGeometry {
	const segments = 40,
		stride = segments + 1;
	const positions: number[] = [],
		uv: number[] = [],
		indices: number[] = [];
	for (const top of [true, false]) {
		for (let z = 0; z <= segments; z++)
			for (let x = 0; x <= segments; x++) {
				const u = (2 * x) / segments - 1,
					v = (2 * z) / segments - 1;
				positions.push((u * w) / 2, kissenHoehe(u, v, h, top), (v * d) / 2);
				uv.push(x / segments, z / segments);
			}
	}
	const layer = stride * stride;
	for (let z = 0; z < segments; z++)
		for (let x = 0; x < segments; x++) {
			const a = z * stride + x,
				b = a + 1,
				c = a + stride,
				e = c + 1;
			indices.push(
				a,
				c,
				b,
				b,
				c,
				e,
				a + layer,
				b + layer,
				c + layer,
				b + layer,
				e + layer,
				c + layer
			);
		}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return geometry;
}

function naht(w: number, d: number, h: number): THREE.BufferGeometry {
	const radius = Math.min(w, d, h) * 0.012;
	const richtungen = [
		{ lage: -0.55, quer: false },
		{ lage: 0, quer: false },
		{ lage: 0.55, quer: false },
		{ lage: 0, quer: true }
	];
	const seams = richtungen.map(({ lage, quer }) => {
		const points = Array.from({ length: 65 }, (_, i) => {
			const vorschub = ((i / 64) * 2 - 1) * 0.96;
			const [u, v] = quer ? [vorschub, lage] : [lage, vorschub];
			return new THREE.Vector3(
				(u * w) / 2,
				kissenHoehe(u, v, h, true) + radius * 0.94,
				(v * d) / 2
			);
		});
		return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, radius, 8, false);
	});
	const merged = mergeGeometries(seams);
	for (const seam of seams) seam.dispose();
	return merged;
}

/** Envelope (`kissen`) or fitted seam ribbons (`naht`) inside the hull [w, h, d]; caller owns it. */
export function membranGeometrie(p: Membran, w: number, d: number, h: number) {
	const kreuz = p.form === 'kreuz';
	if (p.art === 'kissen') return kreuz ? polsterGeometrie(w, d, h) : kissen(w, d, h);
	return kreuz ? polsterNahtGeometrie(w, d, h) : naht(w, d, h);
}
