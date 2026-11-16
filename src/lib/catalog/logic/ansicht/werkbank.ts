/**
 * Workbench: one scene, three synchronized views (113): main view, plan, section.
 * All three are projections of the same data and the same selection.
 */
import { flows } from '../../data/focus';
import type { Primitive, Vec3 } from '../parametrik/types';
import { applyFokus, auswahlKey, selected, type Darstellung } from './fokus';
import { area, bounds, boxPolygon, rotated, union, type Bounds } from './geometrie';
import { ebene, schneiden, type Schnitt } from './schnitt';
import { STOREY, tagFor, type Tags } from './tags';

export type Achse = 'x' | 'y';
export type WerkbankSchnitt = {
	/** Horizontal section in the main view. */
	horizontal: boolean;
	/** Vertical section in the main view. */
	vertikal: boolean;
	/** Floor of the floor plan (plan) and of the horizontal plane. */
	geschoss: number;
	achse: Achse;
	/** Position of the vertical plane in meters. */
	lage: number;
};

/** Plan cut height above the floor slab (the usual plan cut height, above the module's ceiling). */
export const PLAN_CUT = 1.6;
export const schnittHoehe = (geschoss: number) => geschoss * STOREY + PLAN_CUT;

export function ansichten(
	base: Primitive[],
	tags: Tags,
	d: Darstellung,
	s: WerkbankSchnitt,
	/** Envelope of what is built: draws the section line in plan and section (A–A, 113). */
	marke?: Bounds
): { haupt: Primitive[]; plan: Primitive[]; schnitt: Primitive[] } {
	const shown = applyFokus(base, tags, d);
	const h = schnittHoehe(s.geschoss),
		v = ebene(s.achse, s.lage);
	const main: Schnitt = { hoehe: s.horizontal ? h : null, vertikal: s.vertikal ? v : null };
	return {
		haupt: schneiden(shown, main),
		plan: [
			...schneiden(shown, { hoehe: h, vertikal: null }),
			...(marke ? [planMarke(marke, s)] : [])
		],
		schnitt: [
			...schneiden(shown, { hoehe: null, vertikal: v }),
			...(marke ? [schnittMarke(marke, s)] : [])
		]
	};
}

const line = (id: string, points: Vec3[]): Primitive => ({
	id,
	kind: 'polyline',
	points,
	role: 'neu',
	token: '--paper',
	material: 'concrete'
});
/** Section line in plan: across what is built, just above the plan cut height. */
export function planMarke(b: Bounds, s: WerkbankSchnitt): Primitive {
	const z = schnittHoehe(s.geschoss) + 0.1,
		pad = 2;
	return s.achse === 'x'
		? line('marke:plan', [
				[s.lage, b.min[1] - pad, z],
				[s.lage, b.max[1] + pad, z]
			])
		: line('marke:plan', [
				[b.min[0] - pad, s.lage, z],
				[b.max[0] + pad, s.lage, z]
			]);
}
/** Floor line in section: shows where the plan cuts. */
export function schnittMarke(b: Bounds, s: WerkbankSchnitt): Primitive {
	const z = schnittHoehe(s.geschoss),
		pad = 2,
		at = s.lage - 0.1;
	return s.achse === 'x'
		? line('marke:schnitt', [
				[at, b.min[1] - pad, z],
				[at, b.max[1] + pad, z]
			])
		: line('marke:schnitt', [
				[b.min[0] - pad, at, z],
				[b.max[0] + pad, at, z]
			]);
}

export const sceneBounds = (base: Primitive[]): Bounds => union(base.map(bounds));
/** Envelope of the new additions (without ground and existing stock): the section plane starts there. */
export function subjectBounds(base: Primitive[], tags: Tags): Bounds {
	const neu = base.filter((p) => {
		const s = tagFor(tags, p).schicht;
		return s !== 'boden' && s !== 'bestand';
	});
	return neu.length ? union(neu.map(bounds)) : builtBounds(base, tags);
}
/** Envelope of what is built (without ground): center for section plane and explosion. */
export const builtBounds = (base: Primitive[], tags: Tags): Bounds =>
	union(base.filter((p) => tagFor(tags, p).schicht !== 'boden').map(bounds));

/** Frame margin for the explosion: the framing stays put while dragging. */
export function explodedBounds(b: Bounds, ebenen: number, module: number, levels: number): Bounds {
	const grow = 1 + module;
	const cx = (b.min[0] + b.max[0]) / 2,
		cy = (b.min[1] + b.max[1]) / 2;
	return {
		min: [cx + (b.min[0] - cx) * grow, cy + (b.min[1] - cy) * grow, b.min[2] - ebenen],
		max: [cx + (b.max[0] - cx) * grow, cy + (b.max[1] - cy) * grow, b.max[2] + ebenen * levels]
	};
}

export type Kennzahl = { label: string; value: string; unit: string };
export type Auswahl = {
	teile: number;
	key: string;
	titel: string;
	strom: string;
	kennzahlen: [Kennzahl, Kennzahl, Kennzahl];
};

const footprint = (p: Primitive): number =>
	p.kind === 'prism'
		? area(rotated(p.polygon, p.rotation ?? 0))
		: p.kind === 'box'
			? area(boxPolygon(p.position, p.size, p.rotation))
			: 0;

/** Feedback on selection (90-ideen no. 9): exactly three metrics. */
export function auswahlInfo(
	base: Primitive[],
	tags: Tags,
	key: string | undefined
): Auswahl | null {
	if (!key) return null;
	const parts = base.filter((p) => selected(tagFor(tags, p), key));
	if (!parts.length) return null;
	const t = tagFor(tags, parts[0]);
	const solids = parts.filter((p) => p.kind !== 'polyline');
	const b = union(parts.map(bounds));
	// Area: sum of the slabs (ceilings, flat); without slabs the largest footprint.
	const plates = solids.filter((p) => p.kind === 'prism' && p.height <= 0.6);
	const flaeche = plates.length
		? plates.reduce((n, p) => n + footprint(p), 0)
		: Math.max(0, ...solids.map(footprint));
	const strom = solids.map((p) => tagFor(tags, p).flow).find((f) => f);
	return {
		key,
		titel: t.module,
		teile: solids.length,
		strom: strom ? flows.find((f) => f.id === strom)!.name : 'White architectural model',
		kennzahlen: [
			{ label: 'Level', value: String(t.level), unit: `+${(t.level * STOREY).toFixed(0)} m` },
			{ label: 'Area', value: flaeche.toFixed(0), unit: 'm² slab' },
			{ label: 'Height', value: (b.max[2] - b.min[2]).toFixed(1), unit: 'm' }
		]
	};
}

export { auswahlKey };
export type { Vec3 };
