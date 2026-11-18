/** Angular mineral block: a box hull with seeded corner chamfers. Local x right, y up. */
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { studienZufall as zufall } from '../logic/material/studienZufall';

/** Each corner becomes a triangle whose legs are up to 24 % of the shorter extent on top; ground corners stay nearly sharp. */
function eckpunkte(w: number, d: number, h: number, saat: number): THREE.Vector3[] {
	const punkte: THREE.Vector3[] = [];
	const basis = Math.min(w, d, h) * 0.24;
	for (let ecke = 0; ecke < 8; ecke++) {
		const sx = ecke & 1 ? 1 : -1,
			sy = ecke & 2 ? 1 : 0,
			sz = ecke & 4 ? 1 : -1;
		// Ground corners stay nearly sharp so the block sits flat; top corners break more.
		const tiefe = basis * (sy ? 0.45 + zufall(saat, ecke) * 0.55 : 0.08);
		const schnitt = !sy && zufall(saat, ecke + 8) < 0.5 ? 0.002 : tiefe;
		const [cx, cy, cz] = [(sx * w) / 2, sy * h, (sz * d) / 2];
		const ab = (k: number) => schnitt * (0.55 + 0.9 * zufall(saat, ecke * 3 + k + 16));
		punkte.push(
			new THREE.Vector3(cx - sx * ab(0), cy, cz),
			new THREE.Vector3(cx, cy + (sy ? -1 : 1) * ab(1), cz),
			new THREE.Vector3(cx, cy, cz - sz * ab(2))
		);
	}
	return punkte;
}

/**
 * Projects a convex chamfered block inside the hull [w, h, d], base at y = 0, centered in x/z.
 * Deterministic for a seed; planar facets with flat normals. The caller owns the geometry.
 */
export function brockenGeometrie(w: number, d: number, h: number, saat: number) {
	return new ConvexGeometry(eckpunkte(w, d, h, saat >>> 0));
}

/** Alternating hexagonal rings produce broad triangular mirror faces in the given meter hull. */
export function facettenGeometrie(wM: number, dM: number, hM: number) {
	const ringe = [
		{ hoehe: 0, radius: 0.68, drehung: 0 },
		{ hoehe: hM * 0.49, radius: 1, drehung: 0.5 },
		{ hoehe: hM, radius: 0.56, drehung: 0 }
	];
	const punkte = ringe.flatMap(({ hoehe, radius, drehung }) =>
		Array.from({ length: 6 }, (_, i) => {
			const winkel = ((i + drehung) * Math.PI) / 3;
			return new THREE.Vector3(
				(wM / 2) * radius * Math.cos(winkel),
				hoehe,
				(dM / 2) * radius * Math.sin(winkel)
			);
		})
	);
	return new ConvexGeometry(punkte);
}
