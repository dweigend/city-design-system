import { BoxGeometry, Vector3 } from 'three';

function falte(x: number, y: number, z: number) {
	const bogen = Math.sin(7.5 * x - 6.2 * y + 4.6 * z + 1.2 * Math.sin(4 * y + 2.8 * z));
	const quer = Math.sin(12 * x + 8 * y - 5 * z + Math.cos(3.7 * x - 7 * z));
	const falten = 0.53 * Math.abs(bogen) + 0.31 * Math.abs(quer);
	return falten * (0.86 + 0.14 * Math.sin(5 * x + 9 * y + 3 * z));
}

function einfassung(x: number, y: number, z: number) {
	const achsen = [Math.abs(x), Math.abs(y), Math.abs(z)].sort((a, b) => b - a);
	return Math.max(0, Math.min(1, (1 - achsen[1]) * 5));
}

/**
 * Builds a wrinkled, closed wrap inside the meter hull. Shared face edges stay coincident and
 * the bottom remains flat at y=0. No randomness or external texture. Caller owns the geometry.
 */
export function folienGeometrie(wM: number, dM: number, hM: number) {
	const segmente = (mass: number) => Math.max(8, Math.ceil(mass * 13));
	const basis = new BoxGeometry(wM, hM, dM, segmente(wM), segmente(hM), segmente(dM));
	const position = basis.getAttribute('position');
	const normal = basis.getAttribute('normal');
	const p = new Vector3();
	const n = new Vector3();
	const tiefeM = Math.min(0.085, wM * 0.16, hM * 0.16, dM * 0.16);
	for (let i = 0; i < position.count; i++) {
		p.fromBufferAttribute(position, i);
		n.fromBufferAttribute(normal, i);
		if (n.y < 0) continue;
		const rand = einfassung((2 * p.x) / wM, (2 * p.y) / hM, (2 * p.z) / dM);
		p.addScaledVector(n, -tiefeM * rand * falte(p.x, p.y, p.z));
		position.setXYZ(i, p.x, p.y, p.z);
	}
	basis.translate(0, hM / 2, 0);
	basis.computeVertexNormals();
	return basis;
}
