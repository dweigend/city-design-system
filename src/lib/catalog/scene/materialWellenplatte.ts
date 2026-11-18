import { ExtrudeGeometry, Shape } from 'three';

const lauflaengeM = 0.39;

/** Builds a closed extruded polymer sheet. The caller owns the geometry in the given meter hull. */
export function wellenplatte(wM: number, dM: number, hM: number) {
	const schritte = Math.max(8, Math.ceil((wM / lauflaengeM) * 20));
	const dicke = dM * 0.29;
	const amplitude = (dM - dicke) / 2;
	const profil = new Shape();
	for (let i = 0; i <= schritte; i++) {
		const x = (wM * i) / schritte - wM / 2;
		const tiefe = amplitude * Math.cos((x / lauflaengeM) * 2 * Math.PI);
		if (i === 0) profil.moveTo(x, tiefe - dicke / 2);
		else profil.lineTo(x, tiefe - dicke / 2);
	}
	for (let i = schritte; i >= 0; i--) {
		const x = (wM * i) / schritte - wM / 2;
		const tiefe = amplitude * Math.cos((x / lauflaengeM) * 2 * Math.PI);
		profil.lineTo(x, tiefe + dicke / 2);
	}
	profil.closePath();
	return new ExtrudeGeometry(profil, { depth: hM, bevelEnabled: false }).rotateX(-Math.PI / 2);
}
