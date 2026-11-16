/**
 * Tower on the cell: plinth, stack and crown from the form vocabulary, plus a path outside.
 * Headless and deterministic: the same choice and seed yield the same primitives in the same
 * order. Meters, radians (PROCEDURAL_PRINCIPLES). The forms come unchanged from
 * logic/parametrik/formen; only the composition is made here (zones, heights, footprints).
 */
import { flowToken } from '../../data/focus';
import { formFamilies, formFamily } from '../parametrik/formen';
import { inset } from '../parametrik/formen/geom';
import { defaults, polygonContext } from '../parametrik/formen/zellen';
import { funktion, type FunktionId } from '../parametrik/eckraster/funktion';
import type { ColorToken, Primitive, Role } from '../parametrik/types';
import type { FormContext, FormGroup, Point2 } from '../parametrik/vocab';

export type Zone = 'sockel' | 'stapel' | 'kopf';
export const ZONEN: Zone[] = ['sockel', 'stapel', 'kopf'];

/** Build phases in build order; every phase adds exactly one part. */
export type Phase = 'zelle' | 'sockel' | 'stapel' | 'kopf' | 'weg';
export const PHASEN: Phase[] = ['zelle', 'sockel', 'stapel', 'kopf', 'weg'];

/**
 * Which groups may stand in which zone (form group × building zone). What is forbidden is not
 * offered: no crown in the plinth, existing stock only at the bottom.
 */
export const zonenGruppen: Record<Zone, FormGroup[]> = {
	sockel: ['bestand', 'klotz', 'bogen'],
	stapel: ['klotz', 'rahmen', 'kapsel', 'zylinder', 'huelle'],
	kopf: ['kopf', 'huelle', 'vegetation']
};

/**
 * Families per zone and group. Excluded are families that do not bear in this position
 * (halfpipe as plinth, membrane as stack) or form a zone of their own (greenhouse = crown).
 */
const AUSGENOMMEN: Record<Zone, string[]> = {
	sockel: ['bogen-halfpipe', 'bestand-viadukt', 'klotz-wuerfelstapel', 'klotz-verschraenkt'],
	stapel: ['huelle-membran', 'huelle-gewaechshaus', 'kapsel-ufo', 'klotz-keil'],
	kopf: ['huelle-klimahaut', 'huelle-membran', 'vegetation-voxelbaum']
};

export type ZonenWahl = { familie: string; params?: Record<string, number> };

export type TurmWahl = {
	sockel: ZonenWahl;
	stapel: ZonenWahl;
	kopf: ZonenWahl;
	funktion: FunktionId;
	/** Own floors in the stack (3.5 m each). */
	geschosse: number;
	seed: number;
};

/** Footprint and orientation of the cell; the orientation may come from outside (morph). */
export type Zelle = { polygon: Point2[]; orientation?: number };

/** Heights in meters. */
export const MASSE = {
	sockel: 5,
	/** Existing stock in the plinth: two old-building floors of 4 m each. */
	bestand: 8,
	altbauGeschoss: 4,
	geschoss: 3.5,
	kopf: 5,
	ruecksprung: 1.2,
	weg: 5
} as const;

/**
 * Parameters the tower sets itself: a family's floor count follows the zone
 * (stack: chosen floors, plinth: height / old-building floor). The controls do not show them.
 */
export const GESTEUERT = ['geschosse'];

/** Parameters of the zone family that you set yourself. */
export const freieParameter = (familie: string) =>
	(formFamily(familie)?.params ?? []).filter((p) => !GESTEUERT.includes(p.key));
/** A crown needs at least this many own floors below it. */
export const KOPF_AB = 2;
export const GESCHOSSE = { min: 1, max: 6 } as const;

export const startWahl: TurmWahl = {
	sockel: { familie: 'bestand-block' },
	stapel: { familie: 'rahmen-plugin' },
	kopf: { familie: 'vegetation-kugelbaum', params: { anzahl: 3, groesse: 0.8 } },
	funktion: 'wohnen',
	geschosse: 4,
	seed: 7
};

/** Families of a group allowed in the zone (vocabulary order). */
export function zonenFamilien(zone: Zone, gruppe: FormGroup): string[] {
	if (!zonenGruppen[zone].includes(gruppe)) return [];
	return familienDerGruppe(gruppe).filter((id) => !AUSGENOMMEN[zone].includes(id));
}

const familienDerGruppe = (gruppe: FormGroup) =>
	formFamilies.filter((f) => f.group === gruppe).map((f) => f.id);

/** May this family stand in this zone? */
export function erlaubt(zone: Zone, familie: string): boolean {
	const f = formFamily(familie);
	return !!f && zonenFamilien(zone, f.group).includes(familie);
}

/** Choosing a function means: the crown follows it (family and parameters from funktion.ts). */
export function mitFunktion(wahl: TurmWahl, id: FunktionId): TurmWahl {
	const f = funktion(id);
	return { ...wahl, funktion: f.id, kopf: { familie: f.kopf, params: { ...f.kopfParams } } };
}

/** Swaps the family of a zone; anything not allowed changes nothing. Parameters: the family's remembered values. */
export function mitFamilie(
	wahl: TurmWahl,
	zone: Zone,
	familie: string,
	params?: Record<string, number>
): TurmWahl {
	if (!erlaubt(zone, familie)) return wahl;
	return { ...wahl, [zone]: { familie, params: params ? { ...params } : undefined } };
}

/** Choosing the group of a zone means: show its first allowed family (or the remembered one). */
export function mitGruppe(
	wahl: TurmWahl,
	zone: Zone,
	gruppe: FormGroup,
	gemerkt?: (familie: string) => Record<string, number> | undefined
): TurmWahl {
	const liste = zonenFamilien(zone, gruppe);
	if (!liste.length || formFamily(wahl[zone].familie)?.group === gruppe) return wahl;
	return mitFamilie(wahl, zone, liste[0], gemerkt?.(liste[0]));
}

/** Sets a parameter of the zone family (clamped to the family's range). */
export function mitParameter(wahl: TurmWahl, zone: Zone, key: string, wert: number): TurmWahl {
	const f = formFamily(wahl[zone].familie);
	const spec = f?.params.find((p) => p.key === key);
	if (!f || !spec || !Number.isFinite(wert)) return wahl;
	const v = Math.max(spec.min, Math.min(spec.max, wert));
	return { ...wahl, [zone]: { ...wahl[zone], params: { ...wahl[zone].params, [key]: v } } };
}

/** Effective parameters of the zone family (defaults plus selection). */
export function parameterVon(wahl: TurmWahl, zone: Zone): Record<string, number> {
	const f = formFamily(wahl[zone].familie);
	return f ? { ...defaults(f), ...wahl[zone].params } : {};
}

export const mitGeschossen = (wahl: TurmWahl, n: number): TurmWahl => ({
	...wahl,
	geschosse: clampGeschosse(n)
});

/** The crown is valid if the stack has enough own floors. */
export const kopfGueltig = (wahl: TurmWahl) =>
	wahl.geschosse >= KOPF_AB && formFamily(wahl.stapel.familie)?.group !== 'kapsel';

/** Seed per zone: independent sequences, so that changing one zone does not alter the others. */
export const zonenSaat = (seed: number, zone: Zone | 'weg') =>
	(seed + Math.imul(0x9e3779b9, ['sockel', 'stapel', 'kopf', 'weg'].indexOf(zone) + 1)) >>> 0;

export type Teil = { phase: Phase; primitives: Primitive[] };

export type Turm = {
	teile: Teil[];
	/** Top of the stack and of the crown in meters. */
	hoehe: { sockel: number; stapel: number; gesamt: number };
	kopfGueltig: boolean;
	/** Footprints: plinth = cell, stack and crown step back. */
	flaechen: { sockel: Point2[]; stapel: Point2[] };
};

const clampGeschosse = (n: number) =>
	Math.max(GESCHOSSE.min, Math.min(GESCHOSSE.max, Math.round(Number.isFinite(n) ? n : 1)));

/** Ids stay unique per zone and reveal their phase (selection by click, groups). */
const tag = (phase: Phase, list: Primitive[]): Primitive[] =>
	list.map((p) => ({ ...p, id: `${phase}:${p.id}` }));

/** Phase of a primitive from its id. */
export const phaseVon = (id: string): Phase | undefined => {
	const p = id.split(':')[0] as Phase;
	return PHASEN.includes(p) ? p : undefined;
};

function kontext(
	polygon: Point2[],
	orientation: number | undefined,
	z: number,
	height: number,
	seed: number,
	role: Role,
	token?: ColorToken
): FormContext {
	const base = polygonContext(polygon, seed);
	return {
		...base,
		orientation: orientation ?? base.orientation,
		z,
		height,
		role,
		token
	};
}

function zone(
	familie: string,
	params: Record<string, number> | undefined,
	ctx: FormContext,
	geschosse: number
) {
	const f = formFamily(familie);
	if (!f) return [];
	const spec = f.params.find((p) => p.key === 'geschosse');
	const gesetzt: Record<string, number> = spec
		? { geschosse: Math.max(spec.min, Math.min(spec.max, Math.round(geschosse))) }
		: {};
	return f.generate(ctx, { ...defaults(f), ...params, ...gesetzt });
}

/**
 * Outer edge for the path: the side whose normal points best toward (1, −1). That way the
 * stair stands to the side in the default view (looking from the southwest) and does not hide the tower.
 */
export function wegKante(polygon: Point2[]): { mitte: Point2; normale: Point2; laenge: number } {
	let best = -Infinity,
		out = { mitte: [0, 0] as Point2, normale: [1, 0] as Point2, laenge: 0 };
	const n = polygon.length;
	for (let i = 0; i < n; i++) {
		const [x0, y0] = polygon[i],
			[x1, y1] = polygon[(i + 1) % n];
		const len = Math.hypot(x1 - x0, y1 - y0);
		if (len < 1e-6) continue;
		// Counter-clockwise polygon: outward normal is the edge turned clockwise.
		const nx = (y1 - y0) / len,
			ny = -(x1 - x0) / len;
		const score = (nx - ny) / Math.SQRT2 + len * 1e-3;
		if (score > best + 1e-9) {
			best = score;
			out = { mitte: [(x0 + x1) / 2, (y0 + y1) / 2], normale: [nx, ny], laenge: len };
		}
	}
	return out;
}

/** Square footprint of the path in front of the outer edge, side = MASSE.weg. */
export function wegFlaeche(polygon: Point2[]): Point2[] {
	const { mitte, normale } = wegKante(polygon);
	const s = MASSE.weg / 2,
		[nx, ny] = normale,
		[tx, ty] = [-ny, nx];
	const c: Point2 = [mitte[0] + nx * (s + 0.4), mitte[1] + ny * (s + 0.4)];
	return [
		[c[0] - tx * s - nx * s, c[1] - ty * s - ny * s],
		[c[0] + tx * s - nx * s, c[1] + ty * s - ny * s],
		[c[0] + tx * s + nx * s, c[1] + ty * s + ny * s],
		[c[0] - tx * s + nx * s, c[1] - ty * s + ny * s]
	];
}

/**
 * Builds the tower. The plinth fills the cell, the stack steps back by MASSE.ruecksprung,
 * the crown sits on the stack. An invalid crown is not left out but drawn as glass:
 * the scene shows why it does not bear.
 */
export function turm(wahl: TurmWahl, zelle: Zelle): Turm {
	const geschosse = clampGeschosse(wahl.geschosse);
	const f = funktion(wahl.funktion);
	const farbe = f.token ?? undefined;
	const sockelFam = formFamily(wahl.sockel.familie);
	const sockelRole: Role = sockelFam?.group === 'bestand' ? 'bestand' : 'neu';
	const zS = sockelRole === 'bestand' ? MASSE.bestand : MASSE.sockel,
		zT = zS + geschosse * MASSE.geschoss,
		zK = zT + MASSE.kopf;
	const zellUmriss: Primitive = {
		id: 'umriss',
		kind: 'polyline',
		points: zelle.polygon.map(([x, y]) => [x, y, 0]),
		closed: true,
		role: 'bestand',
		token: '--paper',
		material: 'concrete'
	};
	const stapelFlaeche = inset(
		zelle.polygon,
		MASSE.ruecksprung,
		polygonContext(zelle.polygon, 0).center
	);
	const sockel = zone(
		wahl.sockel.familie,
		wahl.sockel.params,
		kontext(zelle.polygon, zelle.orientation, 0, zS, zonenSaat(wahl.seed, 'sockel'), sockelRole),
		zS / MASSE.altbauGeschoss
	);
	const stapel = zone(
		wahl.stapel.familie,
		wahl.stapel.params,
		kontext(
			stapelFlaeche,
			zelle.orientation,
			zS,
			zT - zS,
			zonenSaat(wahl.seed, 'stapel'),
			'neu',
			farbe
		),
		geschosse
	);
	// Capsules provide no planar roof bearing for the garden head. Reject explicitly.
	const gueltig = geschosse >= KOPF_AB && formFamily(wahl.stapel.familie)?.group !== 'kapsel';
	const kopf = (
		formFamily(wahl.stapel.familie)?.group === 'kapsel'
			? []
			: zone(
					wahl.kopf.familie,
					wahl.kopf.params,
					kontext(
						stapelFlaeche,
						zelle.orientation,
						zT,
						MASSE.kopf,
						zonenSaat(wahl.seed, 'kopf'),
						'neu',
						farbe
					),
					1
				)
	).map((p) => (gueltig ? p : { ...p, glass: true }));
	const weg = zone(
		'erschliessung-wendel',
		{ windungen: geschosse * 0.5 + 0.5, stufen: 14 },
		kontext(
			wegFlaeche(zelle.polygon),
			undefined,
			0,
			zT / 0.9,
			zonenSaat(wahl.seed, 'weg'),
			'neu',
			flowToken.people as ColorToken
		),
		geschosse
	);
	return {
		teile: [
			{ phase: 'zelle', primitives: [zellUmriss] },
			{ phase: 'sockel', primitives: tag('sockel', sockel) },
			{ phase: 'stapel', primitives: tag('stapel', stapel) },
			{ phase: 'kopf', primitives: tag('kopf', kopf) },
			{ phase: 'weg', primitives: tag('weg', weg) }
		],
		hoehe: { sockel: zS, stapel: zT, gesamt: zK },
		kopfGueltig: gueltig,
		flaechen: { sockel: zelle.polygon, stapel: stapelFlaeche }
	};
}

/** All primitives up to and including phase `bis`. */
export function bisPhase(t: Turm, bis: Phase): Primitive[] {
	const k = PHASEN.indexOf(bis);
	return t.teile
		.filter((teil) => PHASEN.indexOf(teil.phase) <= k)
		.flatMap((teil) => teil.primitives);
}

/**
 * Selection frame of a zone: outline at the bottom and top, 0.6 m outward, plus the edges between.
 * Drawn in the selection color (emphasis "auswahl"), so that controls and image stay linked.
 */
export function zonenRahmen(t: Turm, zone: Zone): Primitive[] {
	const flaeche = zone === 'sockel' ? t.flaechen.sockel : t.flaechen.stapel;
	const c = polygonContext(flaeche, 0).center;
	const ring = flaeche.map(([x, y]): Point2 => {
		const dx = x - c[0],
			dy = y - c[1],
			d = Math.hypot(dx, dy) || 1;
		return [x + (dx / d) * 0.6, y + (dy / d) * 0.6];
	});
	const [z0, z1] =
		zone === 'sockel'
			? [0, t.hoehe.sockel]
			: zone === 'stapel'
				? [t.hoehe.sockel, t.hoehe.stapel]
				: [t.hoehe.stapel, t.hoehe.gesamt];
	const base = {
		role: 'neu' as Role,
		token: '--signal' as ColorToken,
		material: 'concrete' as const,
		emphasis: 'auswahl' as const
	};
	const at = (z: number) => ring.map(([x, y]): [number, number, number] => [x, y, z]);
	return [
		{ ...base, id: 'rahmen:unten', kind: 'polyline', points: at(z0 + 0.05), closed: true },
		{ ...base, id: 'rahmen:oben', kind: 'polyline', points: at(z1), closed: true }
	];
}

/** Fixed camera for all states: center and half image height in meters. */
export function turmAnsicht(gesamt = MASSE.sockel + GESCHOSSE.max * MASSE.geschoss + MASSE.kopf) {
	return { center: [0, 0, gesamt * 0.44] as [number, number, number], span: gesamt * 0.54 + 3 };
}
