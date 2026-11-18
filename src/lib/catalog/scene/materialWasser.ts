import * as THREE from 'three/webgpu';
import { wasserFeld } from '../logic/material/wasser';
import type { Stueck } from '../logic/material/formen';

/** Owns the displaced free surface of the two bounded canal studies. Ordinary forms keep their hull. */
export function kanalOberflaeche(s: Stueck) {
	if (s.id !== 'water-volume' && s.id !== 'channel-water') return undefined;
	const [breite, tiefe, pegel] = s.teil.mass;
	let feld = wasserFeld(breite, tiefe);
	const geometry = new THREE.PlaneGeometry(breite, tiefe, feld.nx - 1, feld.nz - 1);
	geometry.rotateX(-Math.PI / 2);
	const position = geometry.getAttribute('position');
	let restS = 0;
	function projiziere() {
		const hoehen = feld.hoehenM;
		for (let i = 0; i < hoehen.length; i++) position.setY(i, pegel + hoehen[i]);
		position.needsUpdate = true;
		geometry.computeVertexNormals();
	}
	projiziere();
	return {
		geometry,
		/** Restore the seeded field without replacing its GPU geometry. */
		reset() {
			feld = wasserFeld(breite, tiefe);
			restS = 0;
			projiziere();
		},
		advance(deltaS: number) {
			restS += Math.min(deltaS, 0.1);
			if (restS < feld.schrittS) return;
			while (restS >= feld.schrittS) {
				feld.schritt();
				restS -= feld.schrittS;
			}
			projiziere();
		}
	};
}
