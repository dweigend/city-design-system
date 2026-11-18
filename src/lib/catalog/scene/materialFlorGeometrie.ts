import { LatheGeometry, Vector2, Vector3 } from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

function profil(radiusM: number, wandM: number, hM: number) {
	const kernM = radiusM - wandM;
	const florM = radiusM - 0.045;
	const stock = [new Vector2(kernM, 0), new Vector2(florM - 0.018, 0)];
	const n = Math.ceil(hM * 48);
	for (let i = 1; i < n; i++) stock.push(new Vector2(florM, (i / n) * hM));
	stock.push(new Vector2(florM - 0.018, hM), new Vector2(kernM, hM), new Vector2(kernM, 0));
	return stock;
}

/** Builds a closed upholstered sleeve inside the metre hull. Fixed tuft silhouette, caller-owned. */
export function florGeometrie(wM: number, dM: number, hM: number, wandM: number) {
	const radiusM = wM / 2;
	const geo = new LatheGeometry(profil(radiusM, wandM, hM), 192);
	const noise = new ImprovedNoise();
	const pos = geo.getAttribute('position');
	const p = new Vector3();
	for (let i = 0; i < pos.count; i++) {
		p.fromBufferAttribute(pos, i);
		const r = Math.hypot(p.x, p.z);
		if (r <= radiusM - wandM * 0.6) {
			pos.setZ(i, p.z * (dM / wM));
			continue;
		}
		const fein = noise.noise(p.x * 54 + 9, p.y * 21 + 4, p.z * 54);
		const grob = noise.noise(p.x * 19 + 2, p.y * 10 + 9, p.z * 19);
		const florM = Math.min(0.043, 0.012 + 0.029 * grob + 0.02 * fein);
		const scale = (r + florM) / r;
		const saum = p.y > hM - 0.085 ? Math.max(0, 0.5 - grob) * 0.012 : 0;
		pos.setXYZ(i, p.x * scale, p.y - saum, p.z * scale * (dM / wM));
	}
	geo.computeVertexNormals();
	return geo;
}
