/**
 * Analysis view of a simulated house: every member gets a value and a class of a color scale.
 * Headless: a class names a color token of `app.css`; the scene and the legend resolve it.
 */
import {
	klassenAusnutzung,
	klassenNormalkraft,
	klassenVerformungFuer,
	type SkalaKlasse
} from '../../data/statikSkala';
import type { Vec3 } from '../traeger/plan';
import { DURCHBIEGUNG_TEILER, type Bauplan } from './plan';

export type AnalyseArt = 'kraft' | 'ausnutzung' | 'verformung';
export type AnalyseStrecke = {
	id: string;
	a: Vec3;
	b: Vec3;
	durchmesserM: number;
	/** A tube that takes compression; drawn hollow, as in the plain view. */
	druck: boolean;
	/** Index into `Analyse.klassen`. */
	klasse: number;
};
export type Analyse = {
	art: AnalyseArt;
	/**
	 * Classes in scale order with their value range in SI units (N, share 0–1, m); the outer
	 * limits may be infinite. Force and utilization have fixed limits, so seeds stay comparable.
	 * Displacement is classed in eighths of the permitted deflection (span / 300), so its limits
	 * follow the span, not the result. `automatisch` is kept for a view that scales with its
	 * largest value; no view does.
	 */
	klassen: SkalaKlasse[];
	automatisch: boolean;
	/** Named extremes for the legend, in the unit of the view. */
	groesster: number;
	kleinster: number;
	strecken: AnalyseStrecke[];
	/**
	 * Floor ribs of a hung capsule between its hanger feet: the path of the load from the floor
	 * into the hangers. Idealized rigid, so they carry no value; displaced like the hanger feet.
	 */
	rippen: [Vec3, Vec3][];
	/** Displacements are drawn enlarged by this factor; 1 for the other views. */
	ueberhoehung: number;
};

/** Enlarged sag reads as about this share of the span. */
const VERFORMUNG_BILDANTEIL = 0.08;
const add = (p: Vec3, u: Vec3, faktor: number): Vec3 => [
	p[0] + u[0] * faktor,
	p[1] + u[1] * faktor,
	p[2] + u[2] * faktor
];
/** A round step at or above `wert`: 1, 2 or 5 times a power of ten. */
function rund(wert: number): number {
	const potenz = 10 ** Math.floor(Math.log10(wert));
	return ([1, 2, 5, 10].find((m) => m * potenz >= wert) ?? 10) * potenz;
}

/**
 * Values and classes of one analysis view, or `undefined` for a plan without simulation.
 * `kraft`: governing axial force, tension positive, fixed symmetric classes. `ausnutzung`:
 * share of capacity in use, five classes up to 1 and one above. `verformung`: mean displacement
 * of the member ends under characteristic load, classed against the permitted deflection of the
 * span; geometry is displaced by `ueberhoehung`. The
 * values belong to the occupancy of `statik.belegung`. Detached; member order of the plan.
 */
export function analysiere(haus: Bauplan, art: AnalyseArt): Analyse | undefined {
	const statik = haus.statik;
	if (!statik) return undefined;
	const ort = new Map(haus.traeger.knoten.map((n) => [n.id, n.p]));
	const null3: Vec3 = [0, 0, 0];
	const betrag = (u: Vec3) => Math.hypot(u[0], u[1], u[2]);
	const roh: (Omit<AnalyseStrecke, 'klasse'> & { wert: number })[] = [];
	const haengt = haus.einbauten.some((e) =>
		haus.anschluesse.some((a) => a.id === e.anschlussId && a.beziehung === 'eingehaengt')
	);
	const teile = [
		...haus.traeger.kanten.map((k) => ({
			id: k.id,
			a: ort.get(k.a),
			b: ort.get(k.b),
			ua: statik.verformungM[k.a] ?? null3,
			ub: statik.verformungM[k.b] ?? null3,
			s: statik.staebe[k.id]
		})),
		...(haengt ? statik.haenger : []).map((h) => ({
			id: h.id,
			a: ort.get(h.knotenId),
			b: h.p,
			ua: statik.verformungM[h.knotenId] ?? null3,
			ub: h.uM,
			s: h
		}))
	];
	const groessteM = Math.max(
		...teile.flatMap((t) => [betrag(t.ua), betrag(t.ub)]),
		Number.MIN_VALUE
	);
	const ueberhoehung =
		art === 'verformung'
			? Math.max(1, rund((VERFORMUNG_BILDANTEIL * statik.spannweiteM) / groessteM) / 2)
			: 1;
	for (const t of teile) {
		if (!t.a || !t.b || !t.s) continue;
		const wert =
			art === 'kraft'
				? t.s.zugN >= t.s.druckN
					? t.s.zugN
					: -t.s.druckN
				: art === 'ausnutzung'
					? t.s.ausnutzung
					: (betrag(t.ua) + betrag(t.ub)) / 2;
		roh.push({
			id: t.id,
			a: art === 'verformung' ? add(t.a, t.ua, ueberhoehung) : t.a,
			b: art === 'verformung' ? add(t.b, t.ub, ueberhoehung) : t.b,
			durchmesserM: t.s.durchmesserM,
			druck: t.s.druck,
			wert
		});
	}
	const werte = roh.map((r) => r.wert);
	const groesster = Math.max(...werte),
		kleinster = Math.min(...werte);
	const klassen: SkalaKlasse[] =
		art === 'kraft'
			? klassenNormalkraft
			: art === 'ausnutzung'
				? klassenAusnutzung
				: klassenVerformungFuer(statik.spannweiteM / DURCHBIEGUNG_TEILER);
	// A rib moves with the two hanger feet at its ends.
	const fuss = new Map(statik.haenger.map((h) => [h.p.join(','), h.uM]));
	const versetzt = (p: Vec3): Vec3 =>
		art === 'verformung' ? add(p, fuss.get(p.join(',')) ?? null3, ueberhoehung) : p;
	return {
		art,
		ueberhoehung,
		klassen,
		automatisch: false,
		rippen: haengt ? statik.rippen.map(([a, b]) => [versetzt(a), versetzt(b)]) : [],
		groesster,
		kleinster,
		strecken: roh.map(({ wert, ...r }) => ({
			...r,
			klasse: Math.max(
				0,
				klassen.findIndex((k) => wert >= k.von && wert < k.bis)
			)
		}))
	};
}
