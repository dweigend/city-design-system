/**
 * Tower plan: genome + seed → instance rows. The tower rule (85) is the order in the code:
 * existing stock carries → frame sets the bays → core and decks → colored plug-in modules → stairs and
 * pipes outside → crown.
 *
 * Fixed carrier: floors × bays around the ring are slots with a fixed id. Every slot reads its
 * random numbers via hash(seed, id, channel); the genome only shifts dimensions and thresholds.
 * So the plan is continuous in the genome: morphing means rewriting rows, never building geometry.
 * Everything here lives in rest space (x/y plan, z height); only the shader applies the position layer.
 */
import type { Vec3 } from '../types';
import { clamp, hash, lerp, schwelle, smooth } from './hash';
import type { Lage } from './lage';
import {
	MUSTER,
	PHASE,
	entlang,
	puffer,
	setze,
	umZ,
	type Puffer,
	type Quat,
	type Teil
} from './puffer';
import type { Genom } from './typen';
import {
	anteile,
	dach,
	kapsel,
	kegel,
	kiste,
	kugel,
	kuppel,
	stab,
	summe,
	zylinder,
	type Form
} from './urform';

/** Floor height in meters. */
export const HF = 3.6;
/** Bays per side; the ring has 4 × FELDER slots. */
export const FELDER = 3;
const RING = 4 * FELDER;
/** Maximum number of floors (no slots exist above it). */
export const G_MAX = 15;
/** Floors per microcosm. */
export const SEG = 3;
/** The lowest floors belong to the existing stock. */
export const SOCKEL = 2;

/** Colors as sRGB 0–1. The scene reads them from the tokens (app.css, flowToken). */
export type Palette = {
	papier: Vec3;
	tinte: Vec3;
	signal: Vec3;
	/** Order: people, water, energy, food, material. */
	strom: [Vec3, Vec3, Vec3, Vec3, Vec3];
};
const MENSCH = 0,
	WASSER = 1,
	ENERGIE = 2,
	NAHRUNG = 3,
	MATERIAL = 4;

/** Four classes = four draw calls: three resolutions of the primal form, plus the skins. */
export type Turmpuffer = { gross: Puffer; mittel: Puffer; grob: Puffer; haut: Puffer };
export const turmpuffer = (): Turmpuffer => ({
	gross: puffer(96),
	mittel: puffer(512),
	grob: puffer(2560),
	haut: puffer(112)
});
export function leere(t: Turmpuffer) {
	t.gross.anzahl = t.mittel.anzahl = t.grob.anzahl = t.haut.anzahl = 0;
}

const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [
	lerp(a[0], b[0], t),
	lerp(a[1], b[1], t),
	lerp(a[2], b[2], t)
];
const NORMAL = [
	[1, 0],
	[0, 1],
	[-1, 0],
	[0, -1]
];
const TANGENTE = [
	[0, 1],
	[-1, 0],
	[0, -1],
	[1, 0]
];
/** Point on the square ring: q in sides (0–4), half edge r. */
function ring(q: number, r: number): [number, number] {
	const m = ((q % 4) + 4) % 4,
		k = Math.min(3, Math.floor(m)),
		c = (m - k) * 2 - 1;
	return [NORMAL[k][0] * r + TANGENTE[k][0] * c * r, NORMAL[k][1] * r + TANGENTE[k][1] * c * r];
}
/** Rotation that aligns local y with the outward normal of side k. */
const seite = (k: number): Quat => umZ((k * Math.PI) / 2 - Math.PI / 2);

const MEMPHIS = [
	MUSTER.streifen,
	MUSTER.punkte,
	MUSTER.schach,
	MUSTER.diagonal,
	MUSTER.zickzack,
	MUSTER.raster,
	MUSTER.terrazzo,
	MUSTER.baender
];

export type Mikrokosmos = { dx: number; dy: number; mass: number; strom: number };

/** Offset, scale and lead color per microcosm. The lowest one sits fixed on the existing stock. */
export function mikrokosmen(g: Genom, saat: number): Mikrokosmos[] {
	const n = Math.ceil(G_MAX / SEG);
	return Array.from({ length: n }, (_, s) => {
		const fest = s === 0 ? 0 : 1,
			id = 8000 + s;
		return {
			dx: (hash(saat, id, 1) * 2 - 1) * g.versatz * g.breite * 0.42 * fest,
			dy: (hash(saat, id, 2) * 2 - 1) * g.versatz * g.breite * 0.42 * fest,
			mass: 1 + (hash(saat, id, 3) - 0.5) * 0.5 * g.versatz * fest,
			strom: Math.floor(hash(saat, id, 4) * 5)
		};
	});
}

/** Continuous offset at height z: stairs, pipes and crown sway from stack to stack. */
export function versatzBei(z: number, mk: Mikrokosmos[]): { dx: number; dy: number; mass: number } {
	const f = clamp(z / HF / SEG, 0, mk.length - 1e-6),
		s = Math.floor(f),
		a = mk[s],
		b = mk[Math.min(mk.length - 1, s + 1)],
		t = smooth(0.72, 1, f - s);
	return { dx: lerp(a.dx, b.dx, t), dy: lerp(a.dy, b.dy, t), mass: lerp(a.mass, b.mass, t) };
}

export type Turm = {
	lage: Lage;
	/** Radius and height of the envelope at rest, for the camera. */
	radius: number;
	hoehe: number;
	mikrokosmen: Mikrokosmos[];
};

export function turm(g: Genom, saat: number, pal: Palette, out: Turmpuffer, richtung = 0): Turm {
	const B = g.breite,
		geschosse = clamp(g.geschosse, SOCKEL + 1, G_MAX),
		H = geschosse * HF,
		wb = (2 * B) / FELDER,
		mk = mikrokosmen(g, saat);
	const R = (id: number, kanal: number) => hash(saat, id, kanal);
	const da = (f: number) => clamp(geschosse - f);
	const farbig = (strom: number, pigment = 0) =>
		mix(pal.papier, pal.strom[strom], g.farbe * (1 - pigment));
	const beton = mix(pal.papier, pal.tinte, 0.09);
	/** Half edge of the plinth slab. */
	const platte = B * 1.85 + 2.5;

	/* ── 0 Existing stock: plinth slab, old building, neighbors. Does not follow the position layer. ─────── */
	const alt: Partial<Teil> = { traeger: 0, phase: PHASE.bestand };
	setze(out.mittel, {
		...alt,
		id: 13000,
		ort: [0, 0, -0.25],
		form: kiste(platte, platte, 0.25),
		farbe: pal.papier,
		muster: MUSTER.raster,
		staerke: 0.16
	});
	setze(out.mittel, {
		...alt,
		id: 13001,
		ort: [0, 0, 2.7],
		form: kiste(B * 0.8, B * 0.62, 2.7),
		farbe: pal.papier,
		muster: MUSTER.fenster,
		staerke: 0.5
	});
	setze(out.mittel, {
		...alt,
		id: 13002,
		ort: [0, 0, 6.3],
		form: dach(B * 0.8, B * 0.62, 0.9),
		farbe: mix(pal.papier, pal.tinte, 0.06)
	});
	for (let i = 0; i < 3; i++) {
		const id = 13010 + i,
			ecke = (Math.floor(R(13009, 1) * 4) + i) % 4,
			hx = lerp(2.2, 3.6, R(id, 1)),
			hy = lerp(1.8, 2.6, R(id, 2)),
			hz = lerp(1.6, 3.1, R(id, 3)),
			[x, y] = ring(ecke + lerp(-0.08, 0.08, R(id, 4)), platte - 4.2),
			q = umZ(R(id, 5) < 0.5 ? 0 : Math.PI / 2);
		setze(out.mittel, {
			...alt,
			id,
			ort: [x, y, hz],
			drehung: q,
			form: kiste(hx, hy, hz),
			farbe: pal.papier,
			muster: MUSTER.fenster,
			staerke: 0.45
		});
		setze(out.mittel, {
			...alt,
			id: id + 3,
			ort: [x, y, 2 * hz + hy * 0.36],
			drehung: q,
			form: dach(hx, hy, hy * 0.36),
			farbe: mix(pal.papier, pal.tinte, 0.06)
		});
	}

	/* ── 1 Frame: columns and beams on the ring, a second shell from 0.55. ───── */
	const rahmen = smooth(0.02, 0.2, g.rahmen),
		schale = smooth(0.5, 0.78, g.rahmen),
		dick = 0.07 + 0.12 * g.rahmen;
	/** Rod from a to b. Presence makes it thinner, never shorter: the structural frame stays closed. */
	const balken = (id: number, a: Vec3, b: Vec3, d: number, mehr: Partial<Teil>) => {
		const v: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
			da = mehr.da ?? 1;
		if (da < 0.02) return;
		setze(out.grob, {
			id,
			ort: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
			drehung: entlang(v),
			form: stab(d * da, Math.hypot(v[0], v[1], v[2]) / 2),
			farbe: pal.signal,
			glanz: 1,
			phase: PHASE.rahmen,
			...mehr,
			da: 1
		});
	};
	for (let f = 0; f < G_MAX; f++) {
		const p = da(f);
		if (p <= 0) break;
		const m = mk[Math.floor(f / SEG)],
			r1 = B * m.mass,
			r2 = r1 + wb * 0.85,
			z0 = f * HF,
			z1 = z0 + HF * p,
			gemein = { folge: f / G_MAX };
		for (let j = 0; j < RING; j++) {
			const q = j / FELDER,
				[ax, ay] = ring(q, r1),
				[bx, by] = ring(q + 1 / FELDER, r1),
				x = ax + m.dx,
				y = ay + m.dy;
			if (rahmen > 0) {
				balken(2000 + f * RING + j, [x, y, z0], [x, y, z1], dick, { ...gemein, da: rahmen });
				balken(3000 + f * RING + j, [x, y, z1], [bx + m.dx, by + m.dy, z1], dick * 0.85, {
					...gemein,
					da: rahmen
				});
			}
			if (schale > 0) {
				const [cx, cy] = ring(q, r2),
					[ex, ey] = ring(q + 1 / FELDER, r2),
					aussen = { ...gemein, da: schale };
				balken(4000 + f * RING + j, [cx + m.dx, cy + m.dy, z0], [cx + m.dx, cy + m.dy, z1], dick, {
					...aussen
				});
				balken(
					5000 + f * RING + j,
					[cx + m.dx, cy + m.dy, z1],
					[ex + m.dx, ey + m.dy, z1],
					dick * 0.85,
					aussen
				);
				balken(6000 + f * RING + j, [x, y, z1], [cx + m.dx, cy + m.dy, z1], dick * 0.7, aussen);
			}
		}
		// Bracing: one bay per side with a diagonal; more frame = more diagonals.
		for (let k = 0; k < 4; k++) {
			const id = 7000 + f * 4 + k,
				feld = Math.floor(R(id, 1) * FELDER),
				kreuz = rahmen * schwelle(g.rahmen, 0.25 + R(id, 2) * 0.75);
			// Inner and outer cross-fade: the diagonal moves continuously into the second shell.
			for (const [nr, r, teil] of [
				[id, r1, 1 - schale],
				[id + 500, r2, schale]
			]) {
				const [ax, ay] = ring(k + feld / FELDER, r),
					[bx, by] = ring(k + (feld + 1) / FELDER, r);
				balken(nr, [ax + m.dx, ay + m.dy, z0], [bx + m.dx, by + m.dy, z1], dick * 0.6, {
					...gemein,
					da: kreuz * teil
				});
			}
		}
	}

	/* ── 2 Core and decks: white architectural model, stays put on the axis. ─────────────── */
	const rk = g.kern * B;
	for (let f = 0; f < G_MAX; f++) {
		const p = da(f);
		if (p <= 0) break;
		const m = mk[Math.floor(f / SEG)],
			z0 = f * HF;
		setze(out.gross, {
			id: 8400 + f,
			ort: [0, 0, z0 + (HF * p) / 2],
			// Sharp in plan: rounding the space makes core and decks round.
			form: kiste(rk, rk, (HF * p) / 2),
			farbe: beton,
			muster: MUSTER.baender,
			staerke: 0.3,
			phase: PHASE.kern,
			folge: f / G_MAX
		});
		if (f >= SOCKEL)
			setze(out.gross, {
				id: 8500 + f,
				ort: [m.dx, m.dy, z0],
				form: kiste(B * m.mass * 1.02, B * m.mass * 1.02, 0.15),
				farbe: pal.papier,
				da: smooth(0, 1, p),
				phase: PHASE.kern,
				folge: f / G_MAX
			});
	}
	const oben = versatzBei(H, mk);
	setze(out.gross, {
		id: 8599,
		ort: [oben.dx, oben.dy, H],
		form: kiste(B * oben.mass * 1.02, B * oben.mass * 1.02, 0.15),
		farbe: pal.papier,
		phase: PHASE.kern,
		folge: 1
	});

	/* ── 3 Modules: one slot per bay and floor, form from the vocabulary. ────── */
	const gewichte = [g.kiste, g.zylinder, g.kegel, g.kuppel, g.kugel, g.kapsel];
	const stufe = g.rundung * 0.9,
		kante = g.rundung * 0.7;
	for (let f = SOCKEL; f < G_MAX; f++) {
		const p = da(f);
		if (p <= 0) break;
		const s = Math.floor(f / SEG),
			m = mk[s],
			r1 = B * m.mass,
			z0 = f * HF + 0.15;
		for (let j = 0; j < RING; j++) {
			const id = f * RING + j,
				gerade = f % 2 === 0;
			// Double-height floor: even slots may swallow the bay above (fixed topology).
			if (!gerade && R(id - RING, 8) < 0.17) continue;
			const doppelt = gerade && f + 1 < G_MAX && R(id, 8) < 0.17;
			const anwesend = p * schwelle(g.dichte, R(id, 1));
			if (anwesend <= 0) continue;
			const k = Math.floor(j / FELDER),
				i = j % FELDER,
				us = R(id, 4),
				uo = R(id, 5),
				hoch = HF * 0.9 * (doppelt ? 1 + clamp(geschosse - f - 1) : 1),
				w = wb * 0.94,
				d = wb * (0.75 + 0.45 * us),
				mass = lerp(0.72, 1.12, us) * g.groesse,
				rr = Math.min(w, d) / 2;
			const teile = anteile(R(id, 2), gewichte);
			const form: Form = summe(
				[
					kiste(
						(w / 2) * lerp(0.62, 1, R(id, 10)) * Math.min(g.groesse, 1.25),
						(d / 2) * g.groesse,
						hoch / 2,
						stufe,
						kante
					),
					zylinder(rr * 1.02 * mass, hoch / 2, g.rundung * 0.5),
					kegel(rr * 1.05 * mass, (hoch / 2) * 1.15),
					kuppel(rr * 1.1 * mass),
					kugel((Math.min(w, d, HF * 1.25) / 2) * 1.05 * mass),
					kapsel(
						(Math.min(w, HF * 0.9) / 2) * 0.95 * Math.min(mass, 1.15),
						(d / 2) * (1.15 + 0.7 * g.auskragung) * g.groesse
					)
				],
				teile
			);
			const kragt = g.auskragung * (uo * uo * wb * 1.5 + teile[5] * form.hy * 0.5),
				radial = r1 - form.hy + kragt,
				quer = (-1 + (2 * i + 1) / FELDER) * r1,
				ort: Vec3 = [
					NORMAL[k][0] * radial + TANGENTE[k][0] * quer + m.dx,
					NORMAL[k][1] * radial + TANGENTE[k][1] * quer + m.dy,
					z0 + form.hz
				];
			const uc = R(id, 3),
				strom = uc < 0.55 ? m.strom : Math.min(4, Math.floor(((uc - 0.55) / 0.45) * 5)),
				um = R(id, 6),
				weiss = um < 0.14,
				lack = um > 0.6,
				up = R(id, 7),
				fenster = up < 0.34 || teile[5] > 0.5,
				muster = fenster
					? teile[5] + teile[4] > 0.5
						? MUSTER.bullauge
						: up < 0.08
							? MUSTER.tor
							: MUSTER.fenster
					: MEMPHIS[Math.floor(R(id, 12) * MEMPHIS.length)],
				stark = schwelle(g.muster, R(id, 11));
			const gemein: Partial<Teil> = {
				drehung: seite(k),
				phase: PHASE.modul,
				folge: (f + j / RING) / (G_MAX + 1),
				explR: B * (0.55 + uo)
			};
			if (R(id, 9) < 0.13) {
				// Frosted skin around a colored, opaque core (material rule 9).
				setze(out.haut, {
					...gemein,
					id,
					ort,
					form,
					da: anwesend,
					farbe: mix(pal.papier, pal.strom[strom], 0.2 + 0.3 * g.farbe),
					deckkraft: 0.3,
					muster: strom === NAHRUNG ? MUSTER.raster : MUSTER.keins,
					staerke: 0.5
				});
				setze(out.mittel, {
					...gemein,
					id: 1000 + id,
					ort: [ort[0], ort[1], ort[2] - form.hz * 0.4],
					form: { ...form, hx: form.hx * 0.55, hy: form.hy * 0.55, hz: form.hz * 0.55 },
					da: anwesend * 0.999,
					farbe: farbig(strom),
					glanz: 1
				});
			} else
				setze(out.mittel, {
					...gemein,
					id,
					ort,
					form,
					da: anwesend,
					farbe: weiss ? pal.papier : farbig(strom, lack ? 0 : 0.32),
					glanz: lack ? 1 : 0,
					muster,
					staerke: fenster ? 0.35 + 0.5 * stark : stark * 0.85
				});
		}
	}
	// Large form: one body per microcosm that penetrates the grid (the one glossy body).
	for (let s = 0; s < mk.length; s++) {
		const id = 8200 + s,
			f = s === 0 ? SOCKEL : s * SEG + 1,
			m = mk[s],
			r1 = B * m.mass,
			anwesend = da(f) * schwelle(g.dichte * 0.85 + 0.15, R(id, 1) * 0.85);
		if (anwesend <= 0) continue;
		const S = r1 * lerp(0.42, 0.62, R(id, 4)) * Math.pow(g.groesse, 0.7),
			form = summe(
				[
					kiste(S * 0.9, S * 1.25, HF * 1.15, stufe, kante),
					zylinder(S, HF * 1.3, g.rundung * 0.3),
					kegel(S, HF * 1.5),
					kuppel(S * 1.05),
					kugel(S),
					kapsel(S * 0.62, S * 1.6)
				],
				anteile(R(id, 3), gewichte)
			),
			q = Math.floor(R(id, 2) * 8) / 2,
			[x, y] = ring(q, r1 * (0.78 + 0.34 * g.auskragung * R(id, 5)));
		setze(out.gross, {
			id,
			ort: [x + m.dx, y + m.dy, f * HF + 0.15 + form.hz],
			drehung: umZ(Math.atan2(y, x) - Math.PI / 2),
			form,
			da: anwesend,
			farbe: farbig(m.strom),
			glanz: 2,
			muster: MEMPHIS[Math.floor(R(id, 6) * MEMPHIS.length)],
			staerke: schwelle(g.muster, R(id, 7) * 0.7),
			phase: PHASE.modul,
			folge: f / G_MAX,
			explR: B * 1.5
		});
	}

	/* ── 4 Networks: envelope, stairs (people), pipes (water, energy, material). ── */
	for (let s = 0; s < mk.length; s++) {
		const id = 8300 + s,
			m = mk[s],
			zlo = Math.max(s * SEG, SOCKEL) * HF,
			zhi = Math.min((s + 1) * SEG, geschosse) * HF,
			anwesend = smooth(0.2, 1.5, (zhi - zlo) / HF) * schwelle(g.huelle, R(id, 1) * 0.85);
		if (anwesend <= 0) continue;
		const rH = B * m.mass * 1.14 + 0.9 + g.auskragung * wb * 0.25,
			hz = ((zhi - zlo) / 2) * 0.98;
		setze(out.haut, {
			id,
			ort: [m.dx, m.dy, (zlo + zhi) / 2 + 0.1],
			form: kiste(rH, rH, hz, g.rundung * 0.9, g.rundung * 0.8),
			da: anwesend,
			farbe: mix(pal.papier, pal.strom[m.strom], 0.22 + 0.2 * g.farbe),
			deckkraft: 0.24,
			muster: m.strom === NAHRUNG ? MUSTER.raster : MUSTER.keins,
			staerke: 0.4,
			// For skins, the “glanz” field carries the lattice share (gyroid cut).
			glanz: g.gitter,
			phase: PHASE.netz,
			folge: s / mk.length,
			// Negative: the skins move sideways as a whole (ghost tower beside the tower).
			explR: -(B * 2.6 + 6),
			traeger: 2
		});
	}
	const treppe = smooth(0, 0.25, g.treppe),
		rosa = mix(pal.papier, pal.strom[MENSCH], Math.max(g.farbe, 0.55)),
		STUFEN = 8;
	if (treppe > 0)
		for (let f = 0; f < G_MAX; f++) {
			const p = da(f);
			if (p <= 0) break;
			const k = f % 4,
				id = 9000 + f * 16,
				gemein = {
					da: p * treppe,
					drehung: seite(k),
					farbe: rosa,
					glanz: 1,
					phase: PHASE.netz,
					folge: f / G_MAX,
					explR: 0
				};
			for (let i = 0; i < STUFEN; i++) {
				const t = (i + 0.5) / STUFEN,
					z = f * HF + HF * t,
					v = versatzBei(z, mk),
					rho = B * v.mass + 1.15,
					[x, y] = ring(k + (0.09 + 0.82 * t), rho);
				setze(out.grob, {
					...gemein,
					id: id + i,
					ort: [x + v.dx, y + v.dy, z - (HF / STUFEN) * 0.3],
					// Block steps: taller than one riser, so the flight becomes a solid body (18).
					form: kiste((0.82 * rho) / STUFEN, 0.52, (HF / STUFEN) * 0.8)
				});
			}
			// Landing at the corner, stringer on the outside of the flight.
			const v1 = versatzBei((f + 1) * HF, mk),
				v0 = versatzBei(f * HF, mk),
				rho1 = B * v1.mass + 1.15,
				rho0 = B * v0.mass + 1.15,
				[px, py] = ring(k + 1, rho1 - 0.2);
			setze(out.grob, {
				...gemein,
				id: id + 10,
				ort: [px + v1.dx, py + v1.dy, (f + 1) * HF],
				form: kiste(0.8, 0.8, 0.1)
			});
			const [ax, ay] = ring(k + 0.09, rho0 + 0.52),
				[bx, by] = ring(k + 0.91, rho1 + 0.52),
				a: Vec3 = [ax + v0.dx, ay + v0.dy, f * HF + 1.05],
				b: Vec3 = [bx + v1.dx, by + v1.dy, (f + 1) * HF + 1.05],
				w: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
			setze(out.grob, {
				...gemein,
				id: id + 11,
				ort: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
				drehung: entlang(w),
				form: stab(0.05, Math.hypot(w[0], w[1], w[2]) / 2),
				farbe: mix(rosa, pal.tinte, 0.25)
			});
		}
	const netze = [WASSER, ENERGIE, MATERIAL];
	for (let n = 0; n < netze.length; n++) {
		const anwesend = smooth(n / 3, n / 3 + 0.25, g.leitung);
		if (anwesend <= 0) continue;
		const id = 20000 + n * 1000,
			q0 = R(id, 1) * 4,
			steig = ((0.45 + 0.5 * R(id, 2)) * 4 * (n === 1 ? -1 : 1)) / (9 * HF),
			dickR = (0.26 - 0.04 * n) * anwesend,
			farbe = mix(pal.papier, pal.strom[netze[n]], Math.max(g.farbe, 0.6)),
			punkt = (z: number): Vec3 => {
				const v = versatzBei(z, mk),
					[x, y] = ring(q0 + steig * z, B * v.mass + 0.5 + 0.45 * n);
				return [x + v.dx, y + v.dy, z];
			},
			rohr = (rid: number, a: Vec3, b: Vec3, z: number) => {
				const v: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
					len = Math.hypot(v[0], v[1], v[2]);
				if (len < 0.05) return;
				setze(out.grob, {
					id: rid,
					ort: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
					drehung: entlang(v),
					form: { ...stab(dickR, len / 2 + dickR * 0.5, 1), rt: dickR, rb: dickR },
					farbe,
					glanz: 1,
					phase: PHASE.netz,
					folge: z / (G_MAX * HF),
					explR: 0
				});
			};
		const TEIL = HF / 4,
			fuss = 0.4,
			ende = H + 0.6;
		for (let i = 0; i * TEIL < ende; i++) {
			const za = Math.max(fuss, i * TEIL),
				zb = Math.min(ende, (i + 1) * TEIL);
			if (zb > za) rohr(id + i, punkt(za), punkt(zb), za);
		}
		// Network connection: out along the ground to the edge of the plinth slab (47).
		const p0 = punkt(fuss),
			weit = platte / Math.max(Math.abs(p0[0]), Math.abs(p0[1]), 1e-6);
		rohr(id + 900, p0, [p0[0] * weit, p0[1] * weit, fuss], 0);
	}

	/* ── 5 Crown: continuous index into the crown vocabulary. ───────────────────────────── */
	const wk = [0, 1, 2, 3, 4, 5].map((i) => Math.max(0, 1 - Math.abs(g.kopf - i))),
		RK = B * oben.mass * 0.72,
		z0 = H + 0.15,
		kopf: Partial<Teil> = { phase: PHASE.kopf, explZ: H * 0.3 + B * 0.8, traeger: 2 },
		koerper = summe(
			[
				kuppel(RK * 0.7, 0.5),
				kugel(RK * 0.8),
				kegel(RK * 0.82, RK * 1.3),
				zylinder(RK * 0.78, RK * 0.62, 0.2),
				kiste(RK * 1.05, RK * 1.05, 0.55, 0.15, 0.3),
				kiste(RK * 0.42, RK * 0.42, 1.3, 0.1, 0)
			],
			wk
		),
		kopffarben = [NAHRUNG, WASSER, ENERGIE, MATERIAL, NAHRUNG, MENSCH],
		nah = Math.round(clamp(g.kopf, 0, 5)),
		// Color contract: two crowns are never blended. The color fades through the white architectural model.
		kopffarbe = mix(pal.papier, farbig(kopffarben[nah], 0.05), clamp(2 * wk[nah] - 1)),
		hals = wk[1] * RK * 0.3 + wk[2] * 0.2;
	setze(out.mittel, {
		...kopf,
		id: 12001,
		ort: [oben.dx, oben.dy, z0 + hals / 2 + 0.3],
		form: zylinder(RK * 0.34, hals / 2 + 0.3),
		farbe: beton,
		folge: 0
	});
	setze(out.gross, {
		...kopf,
		id: 12000,
		ort: [oben.dx, oben.dy, z0 + hals + koerper.hz],
		form: koerper,
		farbe: kopffarbe,
		glanz: 2,
		muster: [
			MUSTER.punkte,
			MUSTER.baender,
			MUSTER.streifen,
			MUSTER.baender,
			MUSTER.raster,
			MUSTER.fenster
		][nah],
		staerke: g.muster * clamp(2 * wk[nah] - 1) * 0.8,
		folge: 0.3
	});
	// Brim: cone and tank carry a ring (22, 19).
	setze(out.gross, {
		...kopf,
		id: 12002,
		ort: [oben.dx, oben.dy, z0 + hals + koerper.hz * lerp(0.1, 1, wk[3])],
		form: zylinder(RK * 1.12, 0.14, 0.6),
		da: Math.max(wk[2], wk[3]),
		farbe: mix(kopffarbe, pal.tinte, 0.12),
		glanz: 2,
		folge: 0.4
	});
	// Geodesic dome as a greenhouse (Fuller): skin with a triangular mesh.
	setze(out.haut, {
		...kopf,
		id: 12003,
		ort: [oben.dx, oben.dy, z0 + (RK * 1.42 * 0.9) / 2],
		form: kuppel(RK * 1.42, 0.9),
		da: wk[0],
		farbe: mix(pal.papier, pal.strom[NAHRUNG], 0.16),
		deckkraft: 0.2,
		muster: MUSTER.dreieck,
		staerke: 0.95,
		folge: 0.7
	});
	for (let i = 0; i < 5; i++) {
		const id = 12010 + i,
			r = lerp(0.7, 1.25, R(id, 1)),
			a = (i / 5) * Math.PI * 2 + R(id, 2),
			weit = RK * lerp(0.55, 0.85, R(id, 3));
		setze(out.mittel, {
			...kopf,
			id,
			ort: [oben.dx + Math.cos(a) * weit, oben.dy + Math.sin(a) * weit, z0 + r * 1.5],
			form: kugel(r),
			da: Math.max(wk[0], wk[4]),
			farbe: farbig(NAHRUNG, 0.1 + 0.25 * R(id, 4)),
			folge: 0.5
		});
		setze(out.grob, {
			...kopf,
			id: id + 10,
			ort: [oben.dx + Math.cos(a) * weit, oben.dy + Math.sin(a) * weit, z0 + r * 0.4],
			form: stab(0.07, r * 0.5),
			da: Math.max(wk[0], wk[4]),
			farbe: pal.tinte,
			folge: 0.5
		});
	}
	// Frame crown: the structural frame grows beyond the roof (134). The mast always stands.
	const krone = wk[5],
		rc = RK * 0.95,
		hc = HF * 1.6;
	for (let j = 0; j < 4; j++) {
		const [ax, ay] = ring(j, rc),
			[bx, by] = ring(j + 1, rc),
			a: Vec3 = [ax + oben.dx, ay + oben.dy, z0],
			b: Vec3 = [bx + oben.dx, by + oben.dy, z0];
		balken(12100 + j, a, [a[0], a[1], z0 + hc], dick, { ...kopf, da: krone, folge: 0.2 });
		balken(12110 + j, [a[0], a[1], z0 + hc], [b[0], b[1], z0 + hc], dick * 0.85, {
			...kopf,
			da: krone,
			folge: 0.5
		});
		balken(12120 + j, a, [b[0], b[1], z0 + hc], dick * 0.6, { ...kopf, da: krone, folge: 0.6 });
	}
	const mast = lerp(RK * 0.5, RK * 1.3, wk[5]) + hals + koerper.hz * 2;
	balken(12130, [oben.dx, oben.dy, z0], [oben.dx, oben.dy, z0 + mast + 1.5], 0.07, {
		...kopf,
		folge: 0.9
	});
	setze(out.mittel, {
		...kopf,
		id: 12131,
		ort: [oben.dx, oben.dy, z0 + mast + 1.8],
		form: kugel(0.32),
		farbe: pal.signal,
		glanz: 2,
		folge: 1
	});

	return {
		lage: {
			hoehe: H,
			rund: g.rund,
			verjuengung: g.verjuengung,
			bauch: g.bauch,
			drall: g.drall,
			biegung: g.biegung,
			richtung
		},
		radius: platte,
		hoehe: H + mast + 3,
		mikrokosmen: mk
	};
}
