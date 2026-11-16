/**
 * Teaching version "Cage / Lattice": a tower of modules on a fixed quad × height carrier,
 * deformed by a trilinear cage with eight control points. The modules carry (u, v, w);
 * the deformation is pure evaluation, the geometry is never rebuilt.
 * Axes: x/y plan, z up (as in vocab.Vec3).
 */
import { random } from '../parametrik/random';

export type V3 = [number, number, number];
export type CageOptionen = { saat: number; scherung: number; verjuengung: number; drehung: number };
export type Rolle = 'modul' | 'kern' | 'treppe';
export type Kiste = { id: string; rolle: Rolle; min: V3; max: V3 };

export const GESCHOSS = 3.6;
export const GESCHOSSE = 8;
export const ZELLE = 5;
/** Outer stair strip: 1.80 m, minus two handrail allowances of 0.12 m = 1.56 m clear (as in e1). */
export const TREPPE = { x0: 20.6, x1: 22.4, reserve: 0.12, soll: 1.5 };
export const MASS: V3 = [TREPPE.x1, 4 * ZELLE, GESCHOSSE * GESCHOSS];

/** Modules, core and outer stair in world meters; deterministic per seed. */
export function turm(saat: number): Kiste[] {
	const rng = random(saat);
	const out: Kiste[] = [];
	const luft = 0.2;
	for (let k = 0; k < GESCHOSSE; k++)
		for (let j = 0; j < 4; j++)
			for (let i = 0; i < 4; i++) {
				const kern = (i === 1 || i === 2) && (j === 1 || j === 2);
				const belegt = kern || rng() < 0.82 - k * 0.06;
				if (!belegt) continue;
				out.push({
					id: `${i}.${j}.${k}`,
					rolle: kern ? 'kern' : 'modul',
					min: [i * ZELLE + luft, j * ZELLE + luft, k * GESCHOSS + luft / 2],
					max: [(i + 1) * ZELLE - luft, (j + 1) * ZELLE - luft, (k + 1) * GESCHOSS - luft / 2]
				});
			}
	// Outer stair: six solid steps along y per floor.
	for (let k = 0; k < GESCHOSSE; k++)
		for (let s = 0; s < 6; s++) {
			const z = k * GESCHOSS + (s * GESCHOSS) / 6;
			out.push({
				id: `t${k}.${s}`,
				rolle: 'treppe',
				min: [TREPPE.x0, 1 + s * 3, z],
				max: [TREPPE.x1, 1 + (s + 1) * 3, z + GESCHOSS / 6]
			});
		}
	return out;
}

/** Eight control points (index i + 2j + 4k). Plinth fixed, crown sheared, tapered, twisted. */
export function kontrollpunkte(o: CageOptionen): V3[] {
	const [X, Y, Z] = MASS;
	const mx = X / 2,
		my = Y / 2;
	return Array.from({ length: 8 }, (_, n) => {
		const i = n & 1,
			j = (n >> 1) & 1,
			k = (n >> 2) & 1;
		let x = i * X,
			y = j * Y;
		if (k) {
			const f = 1 - o.verjuengung;
			const dx = (x - mx) * f,
				dy = (y - my) * f;
			const c = Math.cos(o.drehung),
				s = Math.sin(o.drehung);
			x = mx + dx * c - dy * s + o.scherung * Z;
			y = my + dx * s + dy * c;
		}
		return [x, y, k * Z];
	});
}

/** Trilinear evaluation P(u, v, w). */
export function cage(c: V3[], [u, v, w]: V3): V3 {
	const out: V3 = [0, 0, 0];
	for (let n = 0; n < 8; n++) {
		const g = (n & 1 ? u : 1 - u) * ((n >> 1) & 1 ? v : 1 - v) * ((n >> 2) & 1 ? w : 1 - w);
		out[0] += g * c[n][0];
		out[1] += g * c[n][1];
		out[2] += g * c[n][2];
	}
	return out;
}

function ableitung(c: V3[], [u, v, w]: V3, achse: 0 | 1 | 2): V3 {
	const out: V3 = [0, 0, 0];
	for (let n = 0; n < 8; n++) {
		const b = [n & 1, (n >> 1) & 1, (n >> 2) & 1];
		const f = [u, v, w].map((t, a) => (a === achse ? (b[a] ? 1 : -1) : b[a] ? t : 1 - t));
		const g = f[0] * f[1] * f[2];
		out[0] += g * c[n][0];
		out[1] += g * c[n][1];
		out[2] += g * c[n][2];
	}
	return out;
}

/** Smallest normalized volume Jacobian det(f_u, f_v, f_w) / (|f_u||f_v||f_w|) over 5³ samples. */
export function minJacobian(c: V3[], proben = 5) {
	let m = Infinity;
	for (let a = 0; a < proben; a++)
		for (let b = 0; b < proben; b++)
			for (let d = 0; d < proben; d++) {
				const p: V3 = [a / (proben - 1), b / (proben - 1), d / (proben - 1)];
				const [fu, fv, fw] = [0, 1, 2].map((x) => ableitung(c, p, x as 0 | 1 | 2));
				const det =
					fu[0] * (fv[1] * fw[2] - fv[2] * fw[1]) -
					fu[1] * (fv[0] * fw[2] - fv[2] * fw[0]) +
					fu[2] * (fv[0] * fw[1] - fv[1] * fw[0]);
				const n = Math.hypot(...fu) * Math.hypot(...fv) * Math.hypot(...fw);
				m = Math.min(m, det / n);
			}
	return m;
}

/** Smallest clear stair width after deformation (over all floors and flight positions). */
export function treppenbreite(c: V3[]) {
	const [X, Y] = MASS;
	let m = Infinity;
	for (let k = 0; k <= GESCHOSSE * 2; k++)
		for (let s = 0; s <= 6; s++) {
			const w = k / (GESCHOSSE * 2),
				v = (1 + s * 3) / Y;
			const a = cage(c, [TREPPE.x0 / X, v, w]),
				b = cage(c, [TREPPE.x1 / X, v, w]);
			m = Math.min(m, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) - 2 * TREPPE.reserve);
		}
	return m;
}

/** Normalizes a world position to cage coordinates (u, v, w). */
export const uvw = ([x, y, z]: V3): V3 => [x / MASS[0], y / MASS[1], z / MASS[2]];
