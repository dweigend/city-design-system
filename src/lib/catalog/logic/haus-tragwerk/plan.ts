import { hausZugang } from '../traeger/integration/hochwegnetz';
import type { FlowId } from '../../data/focus';
import { LAENGEN_TOLERANZ, type TraegerPlan, type Vec3 } from '../traeger/plan';
import type { Bestand } from './bestand';
import type { Kennzahlen } from '../statik';
/**
 * Planting space above a roof garden, meters: 0.35 m bed plus growth. No member may cross it.
 * The garden is a planted roof, not a room; it needs light and air, not standing height.
 */
export const GARTEN_LICHT_M = 0.6;
/** Deflection of the span under characteristic load stays below span / this (own demo limit). */
export const DURCHBIEGUNG_TEILER = 300;
/** Length of the walkway branch that reaches the door on the eight meter joint, meters. */
export const ZUGANG_LAENGE_M = 4;
export type HausFamilie = 'raumfachwerk' | 'wabe' | 'faltwerk' | 'kuppel';
export type Beziehung =
	'mittragend' | 'eingehaengt' | 'tragende-huelle' | 'eigenstaendig' | 'versorgung';
export type Anschluss = {
	id: string;
	elementId: string;
	beziehung: Beziehung;
	art: 'raum' | 'garten';
	huelle?: { zentrum: Vec3; radiusM: number };
	polygon: [number, number][];
	z: number;
	hoeheM: number;
	flaecheM2: number;
	knoten: string[];
	fassungen?: { knotenId: string; p: Vec3 }[];
	wandIds: string[];
	traegt?: string;
	tuer: { p: Vec3; breiteM: number; hoeheM: number; tangente: [number, number] };
};
export type Einbau = { id: string; anschlussId: string; nutzung: FlowId };
/** Result of the structural simulation for one member. Forces are envelopes over all load cases. */
export type StabStatik = {
	durchmesserM: number;
	/** `true`: a tube that takes compression. `false`: a rod that only ever pulls. */
	druck: boolean;
	zugN: number;
	druckN: number;
	ausnutzung: number;
	/** A rod that went slack under this occupancy; it carries nothing. */
	schlaff?: true;
};
/** Occupancy that decides the load: use of the hung room, and whether its roof garden exists. */
export type Belegung = { raum: FlowId | 'leer'; garten: boolean };
export type HausStatik = {
	/**
	 * The load the forces belong to. `bemessung`: the heaviest permitted occupancy, for which the
	 * members are sized. Otherwise the occupancy the built carrier was checked for (`nachrechnen`).
	 */
	belegung: Belegung | 'bemessung';
	/** Sized carrier members by edge ID of `Bauplan.traeger`. */
	staebe: Record<string, StabStatik>;
	/**
	 * Links from a carrier node down to the capsule at `p`: hangers (rods) to the floor ribs and
	 * wind struts to the roof edge. `uM` is the displacement of the capsule end.
	 */
	haenger: (StabStatik & { id: string; knotenId: string; p: Vec3; uM: Vec3 })[];
	/** Floor ribs of the capsule between two hanger feet: idealized rigid, not sized. */
	rippen: [Vec3, Vec3][];
	/** Displacement of every carrier node under characteristic load, meters. */
	verformungM: Record<string, Vec3>;
	/**
	 * Shoes on the wall crowns. All press downwards only; `fest` also holds sideways, `gefuehrt`
	 * holds across the span, `gleitend` slides. Largest pressure and largest horizontal force, N.
	 */
	lager: {
		knotenId: string;
		art: 'fest' | 'gefuehrt' | 'gleitend';
		druckN: number;
		schubN: number;
	}[];
	/** Design load hanging in the gap (capsule, garden, people), newtons, and clear span. */
	lastN: number;
	spannweiteM: number;
	kennzahlen: Kennzahlen;
};
export type Bauplan = {
	version: 1;
	saat: number;
	familie: HausFamilie;
	traeger: TraegerPlan;
	anschluesse: Anschluss[];
	einbauten: Einbau[];
	eingang: { id: string; p: Vec3 };
	/** Existing houses the carrier bears on, where they are an input of the design. */
	bestand?: Bestand;
	/** Present where the carrier form follows from the structural simulation. */
	statik?: HausStatik;
};
export type Fehler = 'anschluss-unpassend' | 'kollision' | 'zugang-fehlt' | 'abhaengig';
export type Ergebnis = { plan: Bauplan; fehler?: Fehler };
export function rechteck(x: number, y: number, w: number, d: number): [number, number][] {
	return [
		[x, y],
		[x + w, y],
		[x + w, y + d],
		[x, y + d]
	];
}
export function anschluss(
	elementId: string,
	beziehung: Beziehung,
	polygon: [number, number][],
	z: number,
	hoeheM: number,
	knoten: string[] = [],
	wandIds: string[] = []
): Anschluss {
	const flaecheM2 =
		Math.abs(
			polygon.reduce((s, a, i) => {
				const b = polygon[(i + 1) % polygon.length];
				return s + a[0] * b[1] - b[0] * a[1];
			}, 0)
		) / 2;
	const a = polygon[0],
		b = polygon[1];
	return {
		id: `${elementId}/anschluss`,
		elementId,
		beziehung,
		art: 'raum',
		polygon,
		z,
		hoeheM,
		flaecheM2,
		knoten,
		wandIds,
		tuer: {
			p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z],
			breiteM: 1.5,
			hoeheM: 2.1,
			tangente: [
				(b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1]),
				(b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1])
			]
		}
	};
}
/** Convex footprint extruded from `z` by `hoeheM`, meters. */
export type Prisma = Pick<Anschluss, 'polygon' | 'z' | 'hoeheM'>;
/** Free passage in a door: 1.5 m wide, 0.3 m deep, 2.1 m high. */
export function tuerPrisma(tuer: Anschluss['tuer']): Prisma {
	const [tx, ty] = tuer.tangente,
		[x, y, z] = tuer.p;
	return {
		z,
		hoeheM: 2.1,
		polygon: [
			[-0.75, -0.15],
			[0.75, -0.15],
			[0.75, 0.15],
			[-0.75, 0.15]
		].map(([u, v]) => [x + tx * u - ty * v, y + ty * u + tx * v] as [number, number])
	};
}
/** Convex prism against segment, strict interior: shared boundary is contact, not collision. Meters. */
export function schneidet(a: Vec3, b: Vec3, r: Prisma): boolean {
	let lo = 0,
		hi = 1;
	const clip = (v: number, d: number) => {
		if (Math.abs(d) < LAENGEN_TOLERANZ) return v > LAENGEN_TOLERANZ;
		const t = (LAENGEN_TOLERANZ - v) / d;
		if (d > 0) lo = Math.max(lo, t);
		else hi = Math.min(hi, t);
		return lo < hi;
	};
	if (!clip(a[2] - r.z, b[2] - a[2]) || !clip(r.z + r.hoeheM - a[2], a[2] - b[2])) return false;
	for (let i = 0; i < r.polygon.length; i++) {
		const p = r.polygon[i],
			q = r.polygon[(i + 1) % r.polygon.length];
		const dx = q[0] - p[0],
			dy = q[1] - p[1];
		if (!clip(dx * (a[1] - p[1]) - dy * (a[0] - p[0]), dx * (b[1] - a[1]) - dy * (b[0] - a[0])))
			return false;
	}
	return lo < hi;
}
/** Checks accepted occupied volumes and the eight meter entrance, without renderer or mutation. */
export function pruefeHaus(p: Bauplan): Fehler[] {
	const out: Fehler[] = [];
	if (Math.abs(p.eingang.p[2] - 8) > LAENGEN_TOLERANZ) out.push('zugang-fehlt');
	for (const e of p.einbauten) {
		const a = p.anschluesse.find((a) => a.id === e.anschlussId);
		if (!a) {
			out.push('anschluss-unpassend');
			continue;
		}
		const error = pruefeEinbau(p, a);
		if (error) out.push(error);
	}
	return out;
}
export function pruefeEinbau(p: Bauplan, a: Anschluss): Fehler | undefined {
	const nodes = new Map(p.traeger.knoten.map((n) => [n.id, n.p]));
	const punkt = (id: string): Vec3 => {
		const p = nodes.get(id);
		if (!p) throw new RangeError(`Missing carrier node ${id}`);
		return p;
	};
	const trifft = (r: Prisma) => p.traeger.kanten.some((e) => schneidet(punkt(e.a), punkt(e.b), r));
	if (a.art === 'garten') {
		if (!p.einbauten.some((e) => e.id === a.traegt))
			return p.familie === 'wabe' ? 'abhaengig' : 'anschluss-unpassend';
		// No member through the planting space above the garden floor.
		return trifft({ ...a, hoeheM: GARTEN_LICHT_M }) ? 'kollision' : undefined;
	}
	if (a.flaecheM2 < 8 || a.hoeheM < 2.4 || lichteBreite(a.polygon) < 2.4 - LAENGEN_TOLERANZ)
		return 'anschluss-unpassend';
	if (!hausZugang(p).erreichbar.includes(a.id) || a.tuer.breiteM < 1.5 || a.tuer.hoeheM < 2.1)
		return 'zugang-fehlt';
	if (p.familie === 'kuppel') {
		const radius = p.traeger.werte.radius;
		const centerZ = Math.max(...p.traeger.knoten.map((n) => n.p[2])) - radius;
		if (
			a.huelle &&
			Math.hypot(a.huelle.zentrum[0], a.huelle.zentrum[1], a.huelle.zentrum[2] - centerZ) +
				a.huelle.radiusM >
				radius - 0.2
		)
			return 'kollision';
		if (
			a.polygon.some(([x, y]) =>
				[a.z, a.z + a.hoeheM].some((z) => Math.hypot(x, y, z - centerZ) > radius - 0.2)
			)
		)
			return 'kollision';
	}
	if (trifft(a)) return 'kollision';
	if (trifft(tuerPrisma(a.tuer))) return 'zugang-fehlt';
	if (
		p.einbauten.some((e) => e.anschlussId !== a.id && ueberlappt(a, anschlussVon(p, e.anschlussId)))
	)
		return 'kollision';
}

/** Required attachment within a generated plan. Corrupt foreign plans fail explicitly. */
export function anschlussVon(p: Bauplan, id: string): Anschluss {
	const a = p.anschluesse.find((a) => a.id === id);
	if (!a) throw new RangeError(`Missing attachment ${id}`);
	return a;
}

/** Convex prism SAT; shared walls and roofs are contact, never overlap. */
function ueberlappt(a: Anschluss, b: Anschluss): boolean {
	if (Math.min(a.z + a.hoeheM, b.z + b.hoeheM) - Math.max(a.z, b.z) <= LAENGEN_TOLERANZ)
		return false;
	for (const ring of [a.polygon, b.polygon])
		for (let i = 0; i < ring.length; i++) {
			const p = ring[i],
				q = ring[(i + 1) % ring.length],
				nx = p[1] - q[1],
				ny = q[0] - p[0];
			const aa = a.polygon.map((p) => nx * p[0] + ny * p[1]),
				bb = b.polygon.map((p) => nx * p[0] + ny * p[1]);
			if (
				Math.min(Math.max(...aa), Math.max(...bb)) - Math.max(Math.min(...aa), Math.min(...bb)) <=
				LAENGEN_TOLERANZ
			)
				return false;
		}
	return true;
}

/** Minimum support width of a convex footprint, meters; invariant under rotation. */
export function lichteBreite(polygon: [number, number][]): number {
	return Math.min(
		...polygon.map((a, i) => {
			const b = polygon[(i + 1) % polygon.length];
			const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
			if (length < LAENGEN_TOLERANZ) return Infinity;
			const projections = polygon.map(
				(p) => ((a[1] - b[1]) * p[0] + (b[0] - a[0]) * p[1]) / length
			);
			return Math.max(...projections) - Math.min(...projections);
		})
	);
}
