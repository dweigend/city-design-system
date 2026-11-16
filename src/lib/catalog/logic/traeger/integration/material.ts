/**
 * Material integration: a carrier plan as a bill of materials with recipes. Every component (strut, hub,
 * panel, glass, membrane, floor) receives the material family of its construction type from
 * data/materialTraeger.ts and the recipe of that family from logic/material/rezept.ts. The frame
 * stays without a flow; only the occupancy carries color. The detail level shortens every recipe as on
 * the Material page; as a ghost only the envelope turns milky, the structure stays.
 * Detached data in meters (x/y ground plane, z up), without three.js.
 */
import type { FlowId } from '../../../data/focus';
import type { FamilieId as MaterialFamilie, StufePhaseId } from '../../../data/materialSeite';
import {
	BELEGTES_GLAS,
	bauweisen,
	type Bauteil,
	type BauweiseMaterial
} from '../../../data/materialTraeger';
import type { TraegerFamilieText } from '../../../data/traeger';
import {
	alsGeist,
	detailstufe,
	rezept,
	voreinstellung,
	type Rezept,
	type Strom
} from '../../material/rezept';
import {
	familie,
	figurOrt,
	loopZiel,
	planen,
	type Kante,
	type TraegerPlan,
	type Vec3
} from '../index';

export type StabGruppe = { id: string; rezept: Rezept; radiusM: number; strecken: [Vec3, Vec3][] };
export type NabenGruppe = { rezept: Rezept; radiusM: number; punkte: Vec3[] };
export type FlaechenGruppe = { id: string; rezept: Rezept; ringe: Vec3[][] };
export type MaterialModell = {
	familie: TraegerFamilieText;
	staebe: StabGruppe[];
	naben: NabenGruppe | null;
	flaechen: FlaechenGruppe[];
	/** Valley folds: hairline, no component. */
	linien: [Vec3, Vec3][];
	/** Figure of 1.8 m at the bearing. */
	figur: Vec3;
	grenzen: { min: Vec3; max: Vec3 };
	/** Viewpoint of the close-up: a node on the viewer's side. */
	nah: Vec3;
};

/** View of the stage: direction toward the viewer in plan and tilt above the horizon. */
export const BLICK = { azimutRad: (32 * Math.PI) / 180, hoeheRad: (26 * Math.PI) / 180 } as const;

/** Half strut thickness per role (119 §3: main strut 0.18 m, secondary strut 0.10 m, rib 0.14 m). */
const RADIUS_M: Record<Exclude<Bauteil, 'paneel' | 'glas' | 'membran' | 'boden'>, number> = {
	stab: 0.09,
	nebenstab: 0.05,
	rippe: 0.07,
	falz: 0.05,
	nabe: 0.2
};
const STAB_TEIL: Partial<Record<Kante['rolle'], Bauteil>> = {
	stab: 'stab',
	nebenstab: 'nebenstab',
	rippe: 'rippe',
	berg: 'falz',
	rand: 'falz'
};

const bauweise = (id: TraegerFamilieText): BauweiseMaterial =>
	bauweisen.find((b) => b.id === id) ?? bauweisen[0];

function stufeVon(material: MaterialFamilie, strom: Strom, stufe: StufePhaseId, huelle: boolean) {
	const basis = rezept(material, voreinstellung(material, strom));
	return huelle && stufe === 'geist' ? alsGeist(basis) : detailstufe(basis, stufe);
}

/** Plan of the construction type in the compact version of the Material page. */
export function materialPlan(id: TraegerFamilieText, saat = 42): TraegerPlan {
	const f = familie(id);
	return planen(id, { ...loopZiel(f, f.loop.length - 1), ...bauweise(id).werte }, saat);
}

/** Bill of materials of a plan at one detail level. Order follows the plan; no randomness. */
export function materialModell(plan: TraegerPlan, stufe: StufePhaseId): MaterialModell {
	if (plan.familie === 'orthogonal')
		throw new RangeError('No construction type with its own material');
	const teile = bauweise(plan.familie).teile;
	const ort = new Map(plan.knoten.map((n) => [n.id, n.p]));
	const p = (id: string): Vec3 => ort.get(id) ?? [0, 0, 0];

	const staebe = new Map<Bauteil, StabGruppe>();
	const linien: [Vec3, Vec3][] = [];
	for (const k of plan.kanten) {
		const teil = STAB_TEIL[k.rolle],
			material = teil && teile[teil];
		if (!teil || !material) {
			if (k.rolle === 'tal') linien.push([p(k.a), p(k.b)]);
			continue;
		}
		let g = staebe.get(teil);
		if (!g) {
			g = {
				id: teil,
				rezept: stufeVon(material, 'neutral', stufe, false),
				radiusM: RADIUS_M[teil as keyof typeof RADIUS_M],
				strecken: []
			};
			staebe.set(teil, g);
		}
		g.strecken.push([p(k.a), p(k.b)]);
	}

	const eigner = new Map<string, FlowId>();
	for (const z of plan.zellen) {
		const strom = plan.belegung[z.id];
		if (strom && strom !== 'leer')
			for (const id of z.flaechen) if (!eigner.has(id)) eigner.set(id, strom);
	}
	const flaechen = new Map<string, FlaechenGruppe>();
	for (const f of plan.flaechen) {
		if (f.rolle === 'offen') continue;
		const eigen = plan.belegung[f.id];
		const strom: Strom = eigen && eigen !== 'leer' ? eigen : (eigner.get(f.id) ?? 'neutral');
		const material =
			f.rolle === 'glas' && strom !== 'neutral' ? BELEGTES_GLAS : teile[f.rolle as Bauteil];
		if (!material) continue;
		const id = `${f.rolle}:${material}:${strom}`;
		let g = flaechen.get(id);
		if (!g) {
			g = { id, rezept: stufeVon(material, strom, stufe, f.rolle !== 'boden'), ringe: [] };
			flaechen.set(id, g);
		}
		g.ringe.push(f.knoten.map(p));
	}

	const min: Vec3 = [Infinity, Infinity, Infinity],
		max: Vec3 = [-Infinity, -Infinity, -Infinity];
	for (const n of plan.knoten)
		for (let i = 0; i < 3; i++) {
			min[i] = Math.min(min[i], n.p[i]);
			max[i] = Math.max(max[i], n.p[i]);
		}
	// Close-up: the node nearest to the viewer, near half height.
	const zu: [number, number] = [Math.sin(BLICK.azimutRad), -Math.cos(BLICK.azimutRad)];
	const mitteZ = (min[2] + max[2]) / 2;
	// With the flat shell the frontmost node lies on the edge: the close-up
	// needs an inner crossing point with membrane in all directions.
	const innen = plan.knoten.filter(
		(n) => plan.kanten.filter((k) => k.a === n.id || k.b === n.id).length >= 4
	);
	const kandidaten = plan.familie === 'gitterschale' && innen.length ? innen : plan.knoten;
	const vorn = [...kandidaten].sort((a, b) => {
		if (plan.familie === 'gitterschale') {
			const abstand = (v: Vec3) =>
				Math.hypot(v[0] - (min[0] + max[0]) / 2, v[1] - (min[1] + max[1]) / 2);
			return abstand(a.p) - abstand(b.p) || a.id.localeCompare(b.id);
		}
		return (
			b.p[0] * zu[0] +
				b.p[1] * zu[1] -
				Math.abs(b.p[2] - mitteZ) -
				(a.p[0] * zu[0] + a.p[1] * zu[1] - Math.abs(a.p[2] - mitteZ)) || a.id.localeCompare(b.id)
		);
	})[0];
	return {
		familie: plan.familie,
		staebe: [...staebe.values()],
		naben: teile.nabe
			? {
					rezept: stufeVon(teile.nabe, 'neutral', stufe, false),
					radiusM: RADIUS_M.nabe,
					punkte: plan.knoten.map((n) => n.p)
				}
			: null,
		flaechen: [...flaechen.values()],
		linien,
		figur: figurOrt(plan),
		grenzen: { min, max },
		nah: vorn ? vorn.p : [0, 0, 0]
	};
}

/**
 * Closeness of the view, 1 = at the node, 0 = the whole structure. Pure function of step and share:
 * the camera moves smoothly from the previous closeness to the new one in the first third of a step.
 */
const NAEHE: Record<StufePhaseId, number> = { nah: 1, mittel: 0.5, fern: 0, linie: 0, geist: 0 };
export function naehe(stufen: readonly StufePhaseId[], index: number, anteil: number): number {
	if (!stufen.length) throw new RangeError('No steps');
	const i = ((Math.floor(index) % stufen.length) + stufen.length) % stufen.length;
	const ziel = NAEHE[stufen[i]],
		start = NAEHE[stufen[(i + stufen.length - 1) % stufen.length]];
	const t = Math.max(0, Math.min(1, anteil / 0.35)),
		weich = t * t * (3 - 2 * t);
	return start + (ziel - start) * weich;
}
