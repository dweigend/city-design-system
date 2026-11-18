import * as THREE from 'three';
import { lackfilm } from '../logic/material/lackfilm';

type Film = ReturnType<typeof lackfilm>;
const HOEHENSTUFEN = 14;

function punktAmUmfang(u: number, halbBreit: number, halbTief: number): [number, number] {
	const t = (u % 1) * 4;
	if (t < 1) return [halbBreit * (2 * t - 1), -halbTief];
	if (t < 2) return [halbBreit, halbTief * (2 * t - 3)];
	if (t < 3) return [halbBreit * (5 - 2 * t), halbTief];
	return [-halbBreit, halbTief * (7 - 2 * t)];
}

function frontTiefe(film: Film, i: number): number {
	const n = film.spalten;
	const links = film.front[(i + n - 1) % n];
	const rechts = film.front[(i + 1) % n];
	return Math.max(0.075, film.front[i] * 0.6 + (links + rechts) * 0.2);
}

function filmStaerke(film: Film, spalte: number, tiefe: number, anteil: number): number {
	const r = tiefe * (film.zeilen - 1) * (1 - anteil);
	const i = Math.floor(r);
	const vorn = film.tiefeM[i * film.spalten + spalte];
	const hinten = film.tiefeM[Math.min(i + 1, film.zeilen - 1) * film.spalten + spalte];
	const vorlauf = Math.min(1, Math.sqrt(anteil * 12));
	return 0.001 + vorlauf * Math.min(0.096, 0.018 + 1.8 * THREE.MathUtils.lerp(vorn, hinten, r - i));
}

function filmDreiecke(n: number, deckel: number): number[] {
	const indizes: number[] = [];
	const rand = HOEHENSTUFEN * n;
	for (let i = 0; i < n; i++) {
		const rechts = (i + 1) % n;
		indizes.push(deckel, rand + rechts, rand + i);
		for (let h = 0; h < HOEHENSTUFEN; h++) {
			const a = h * n + i;
			const b = h * n + rechts;
			indizes.push(a, a + n, b, b, a + n, b + n);
		}
	}
	return indizes;
}

/**
 * Projects the settled film into a raised roof and continuous run-off surface.
 * The outer meters enclose a substrate 0.20 m narrower/shallower and 0.045 m lower.
 * Position is local to that substrate; the caller owns the returned geometry.
 */
export function lackfilmGeometrie(breiteM: number, tiefeM: number, hoeheM: number, saat: number) {
	const film = lackfilm(saat);
	const n = film.spalten;
	const vertex: number[] = [];
	for (let h = 0; h <= HOEHENSTUFEN; h++) {
		const anteil = h / HOEHENSTUFEN;
		for (let i = 0; i < n; i++) {
			const front = frontTiefe(film, i);
			const dicke = filmStaerke(film, i, front, anteil);
			const y = hoeheM * (1 - front * (1 - anteil));
			const [x, z] = punktAmUmfang(i / n, breiteM / 2 - 0.1 + dicke, tiefeM / 2 - 0.1 + dicke);
			vertex.push(x, y, z);
		}
	}
	const deckel = vertex.length / 3;
	vertex.push(0, hoeheM, 0);
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertex, 3));
	geometry.setIndex(filmDreiecke(n, deckel));
	geometry.computeVertexNormals();
	return geometry;
}
