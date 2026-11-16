/**
 * Focus by flow, level or layer (data/focus.ts, focus layers) and build phase (134).
 * Material replaces hiding (data/material.ts focusMaterialRules):
 * focus keeps its material, context is matte white architectural model, background is ghost,
 * planned parts are clear glass.
 */
import type { FlowId } from '../../data/focus';
import type { Primitive } from '../parametrik/types';
import { tagFor, type Schicht, type Tag, type Tags } from './tags';

export type FokusArt = 'alle' | 'strom' | 'ebene' | 'schicht';
export type Fokus = {
	art: FokusArt;
	strom?: FlowId;
	ebene?: number;
	schicht?: Schicht;
	/** Selected: auswahlKey (module@level) or module; always focus, strong edge. */
	auswahl?: string;
};
export type Stufe = 'focus' | 'context' | 'background' | 'planned' | 'hidden';

/** Transparency slider (93): 0 context matte · 1 context ghost · 2 background off. */
export type Transparenz = 0 | 1 | 2;

/** Selection key: module on its level (across all build phases). */
export const auswahlKey = (t: Tag) => `${t.module}@${t.level}`;
export const selected = (t: Tag, auswahl?: string) =>
	!!auswahl && (auswahlKey(t) === auswahl || t.module === auswahl);

/** Focus layer of a primitive. Existing stock is never the focus of a flow: it stays context/ghost. */
export function stufe(t: Tag, f: Fokus): Exclude<Stufe, 'planned' | 'hidden'> {
	if (selected(t, f.auswahl)) return 'focus';
	switch (f.art) {
		case 'alle':
			return 'focus';
		case 'strom':
			if (t.flow === f.strom && t.schicht !== 'bestand') return 'focus';
			return t.schicht === 'bestand' || t.schicht === 'geruest' ? 'background' : 'context';
		case 'ebene': {
			const e = f.ebene ?? 0;
			if (t.schicht === 'boden') return 'context';
			// What lies below carries (context), what lies above becomes ghost: the view looks into the floor (100).
			return t.level === e ? 'focus' : t.level < e ? 'context' : 'background';
		}
		case 'schicht':
			if (t.schicht === f.schicht) return 'focus';
			return t.schicht === 'bestand' ? 'background' : 'context';
	}
}

/** Build phase as time t ∈ [0, 4]: built from t ≥ phase − 1 (then it drops in), planned before. */
export const phaseState = (phase: number, t: number): 'built' | 'planned' =>
	phase === 0 || t >= phase - 1 ? 'built' : 'planned';

export type Darstellung = {
	fokus: Fokus;
	transparenz: Transparenz;
	/** Visible layers (layer switches). */
	sichtbar: Set<Schicht>;
	zeit: number;
};

/** Final state from focus, switches, transparency and time. */
export function finalStufe(t: Tag, d: Darstellung): Stufe {
	if (!d.sichtbar.has(t.schicht) && !selected(t, d.fokus.auswahl)) return 'hidden';
	if (phaseState(t.phase, d.zeit) === 'planned') return 'planned';
	const s = stufe(t, d.fokus);
	if (d.transparenz === 0) return s;
	if (s === 'context') return 'background';
	if (s === 'background' && d.transparenz === 2) return 'hidden';
	return s;
}

/** Applies the state to a primitive (material, color and role only; geometry stays). */
export function look(p: Primitive, s: Stufe, emphasis?: Primitive['emphasis']): Primitive | null {
	switch (s) {
		case 'hidden':
			return null;
		case 'focus':
			return emphasis ? { ...p, emphasis } : p;
		case 'context':
			return p.kind === 'polyline'
				? p
				: { ...p, token: '--paper', material: 'paper', shade: 0, pattern: undefined };
		case 'background':
			return p.kind === 'polyline'
				? { ...p, role: 'bestand' }
				: { ...p, token: '--paper', material: 'ghost', glass: false, shade: 0, pattern: undefined };
		case 'planned':
			return p.kind === 'polyline'
				? { ...p, role: 'bestand' }
				: { ...p, token: '--paper', material: 'glass', role: 'neu', shade: 0, pattern: undefined };
	}
}

/** Applies focus to a whole scene. */
export function applyFokus(primitives: Primitive[], tags: Tags, d: Darstellung): Primitive[] {
	const out: Primitive[] = [];
	for (const p of primitives) {
		const t = tagFor(tags, p);
		const s = finalStufe(t, d);
		// Networks of the selected flow stand out (120), and so does the selection.
		const emphasis =
			s !== 'focus'
				? undefined
				: selected(t, d.fokus.auswahl)
					? 'auswahl'
					: d.fokus.art === 'strom' && t.schicht === 'netz'
						? 'netz'
						: undefined;
		const q = look(p, s, emphasis);
		if (q) out.push(q);
	}
	return out;
}
