/**
 * Arrangement and bridges: several towers, connected through ports.
 * A port is a fixed point in a tower's rest space; its world position follows the position layer
 * (lage.ts). The bridge reads only the two port points, never the form of the towers (101 §2).
 */
import type { Vec3 } from '../types';
import { clampMorph, hash, lerp } from './hash';
import { verformen, type Lage } from './lage';
import { PHASE, entlang, mal, setze, umZ, type Puffer, type Quat } from './puffer';
import { HF, G_MAX, SOCKEL, versatzBei, type Mikrokosmos, type Palette } from './turm';
import { strecke, typen, type Genom } from './typen';
import { kiste, stab } from './urform';

export type Aufstellung = 'solo' | 'trio' | 'reihe';
export const aufstellungen: { value: Aufstellung; label: string }[] = [
	{ value: 'solo', label: 'Solo' },
	{ value: 'trio', label: 'Trio' },
	{ value: 'reihe', label: 'Row' }
];

export type Stand = { ort: Vec3; genom: Genom; saat: number; richtung: number };

/**
 * solo: one tower. trio: three variants of the same kind; bending tilts them toward each other.
 * reihe: five stations of the morph path with the same seed (the morph side by side).
 */
export function aufstellen(art: Aufstellung, genom: Genom, saat: number, t: number): Stand[] {
	if (art === 'solo') return [{ ort: [0, 0, 0], genom, saat, richtung: 0 }];
	if (art === 'reihe') {
		const n = 5,
			max = typen.length - 1,
			weite = 47;
		return Array.from({ length: n }, (_, i) => {
			const ti = clampMorph(t + (i - 2) * 0.5, 0, max);
			return {
				// The middle station carries the slider values, the others the pure path point.
				ort: [(i - (n - 1) / 2) * weite, 0, 0] as Vec3,
				genom: i === 2 ? genom : strecke(ti),
				saat,
				richtung: 0
			};
		});
	}
	const weite = genom.breite * 3.1 + 6;
	return [0, 1, 2].map((i) => {
		// Front left, front right, back (the tallest): in isometric view none hides another.
		const a = ([150, -60, 45][i] * Math.PI) / 180,
			ort: Vec3 = [Math.cos(a) * weite, Math.sin(a) * weite, 0],
			u = hash(saat, 500 + i, 1);
		return {
			ort,
			genom: {
				...genom,
				geschosse: clampMorph(genom.geschosse * [1, 0.72, 1.18][i], SOCKEL + 2, G_MAX),
				breite: genom.breite * lerp(0.8, 1, u),
				kopf: Math.min(5, (genom.kopf + i * 2) % 6),
				drall: genom.drall * (i === 1 ? -1 : 1)
			},
			saat: saat + i * 7919,
			// Toward the center: positive bending tilts the towers toward each other.
			richtung: a + Math.PI
		};
	});
}

/** Port point in rest space: on the stair ring facing the neighbor, with twist factored out. */
function port(lage: Lage, mk: Mikrokosmos[], breite: number, z: number, winkel: number): Vec3 {
	const v = versatzBei(z, mk),
		a = winkel - lage.drall * clampMorph(z / lage.hoehe, -0.2, 1.4),
		c = Math.cos(a),
		s = Math.sin(a),
		rho = (breite * v.mass + 2.1) / Math.max(Math.abs(c), Math.abs(s));
	return [c * rho + v.dx, s * rho + v.dy, z];
}

export type Angeschlossen = { stand: Stand; lage: Lage; mikrokosmen: Mikrokosmos[] };

/** Floating bridges between all tower pairs: deck in pink (people), cables in ink. */
export function bruecken(tuerme: Angeschlossen[], pal: Palette, out: Puffer) {
	const rosa: Vec3 = [
		lerp(pal.papier[0], pal.strom[0][0], 0.85),
		lerp(pal.papier[1], pal.strom[0][1], 0.85),
		lerp(pal.papier[2], pal.strom[0][2], 0.85)
	];
	const TEILE = 14;
	let id = 30000;
	for (let i = 0; i < tuerme.length; i++)
		for (let j = i + 1; j < tuerme.length; j++) {
			const a = tuerme[i],
				b = tuerme[j],
				niedrig = Math.min(a.stand.genom.geschosse, b.stand.genom.geschosse),
				// Continuous height: the bridge rises with the towers without snapping to floors.
				z = HF * clampMorph(niedrig * (0.45 + 0.2 * (i + j - 1)), SOCKEL + 1, niedrig - 0.5),
				w = Math.atan2(b.stand.ort[1] - a.stand.ort[1], b.stand.ort[0] - a.stand.ort[0]),
				pa = verformen(port(a.lage, a.mikrokosmen, a.stand.genom.breite, z, w), a.lage),
				pb = verformen(port(b.lage, b.mikrokosmen, b.stand.genom.breite, z, w + Math.PI), b.lage),
				A: Vec3 = [pa[0] + a.stand.ort[0], pa[1] + a.stand.ort[1], pa[2]],
				B: Vec3 = [pb[0] + b.stand.ort[0], pb[1] + b.stand.ort[1], pb[2]],
				spann = Math.hypot(B[0] - A[0], B[1] - A[1]),
				stich = spann * 0.07,
				punkt = (t: number): Vec3 => [
					lerp(A[0], B[0], t),
					lerp(A[1], B[1], t),
					lerp(A[2], B[2], t) + stich * 4 * t * (1 - t)
				];
			for (let k = 0; k < TEILE; k++) {
				const p = punkt(k / TEILE),
					q = punkt((k + 1) / TEILE),
					dx = q[0] - p[0],
					dy = q[1] - p[1],
					dz = q[2] - p[2],
					lauf = Math.hypot(dx, dy),
					neigung = Math.atan2(dz, lauf),
					kipp: Quat = [Math.sin(neigung / 2), 0, 0, Math.cos(neigung / 2)];
				setze(out, {
					id: id++,
					ort: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2],
					drehung: mal(umZ(Math.atan2(dy, dx) - Math.PI / 2), kipp),
					form: kiste(1.05, Math.hypot(lauf, dz) / 2 + 0.04, 0.11),
					farbe: rosa,
					traeger: 0,
					glanz: 1,
					phase: PHASE.netz,
					folge: 0.5 + (0.5 * k) / TEILE
				});
			}
			// Two cables per bank: from the mast point above the port to the bridge midpoint.
			const mitte = punkt(0.5);
			for (const [ufer, t] of [
				[A, 0.3],
				[A, 0.5],
				[B, 0.7],
				[B, 0.5]
			] as [Vec3, number][]) {
				const oben: Vec3 = [ufer[0], ufer[1], ufer[2] + spann * 0.22],
					ziel = t === 0.5 ? mitte : punkt(t),
					v: Vec3 = [ziel[0] - oben[0], ziel[1] - oben[1], ziel[2] - oben[2]],
					len = Math.hypot(v[0], v[1], v[2]);
				setze(out, {
					id: id++,
					ort: [(oben[0] + ziel[0]) / 2, (oben[1] + ziel[1]) / 2, (oben[2] + ziel[2]) / 2],
					drehung: entlang(v),
					form: stab(0.04, len / 2),
					farbe: pal.tinte,
					traeger: 0,
					phase: PHASE.netz,
					folge: 0.9
				});
			}
		}
}
