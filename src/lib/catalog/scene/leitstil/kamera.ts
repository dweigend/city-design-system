import { OrthographicCamera, Vector3 } from 'three';
import type { Stil, Vec3 } from '../../logic/leitstil';
/** The only axis mapping: (x,y,z) world → (x,z,-y) three.js. */
export const welt = ([x, y, z]: Vec3) => new Vector3(x, z, -y);
export function kameraFuer(s: Stil, breite: number, hoehe: number, blickziel?: Vec3) {
	const ppm = (s.kamera.pxProM * breite) / 1000;
	const k = new OrthographicCamera(
		-breite / ppm / 2,
		breite / ppm / 2,
		hoehe / ppm / 2,
		-hoehe / ppm / 2,
		0.1,
		1000
	);
	const ziel = welt(blickziel ?? (s.kamera.pxProM === 60 ? [0, -1, 7] : [0, -1.5, 2.5]));
	const { azimutRad: a, hoeheRad: h } = s.kamera;
	k.position
		.copy(ziel)
		.add(
			new Vector3(Math.sin(a) * Math.cos(h), Math.sin(h), Math.cos(a) * Math.cos(h)).multiplyScalar(
				150
			)
		);
	k.lookAt(ziel);
	k.updateProjectionMatrix();
	return k;
}
