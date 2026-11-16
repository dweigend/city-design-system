/**
 * Color lab (page /farben): coloring of the district from the view state. Headless.
 * Contract (PD-6): mode, flows, step and surface change only the coloring, never the structure.
 * A focus mode colors at most three flows and puts every part in exactly one focus layer:
 * focus (color or strong edge), context (paper, pencil edge), background (hull).
 */
import {
	MAX_FOKUS_STROEME,
	flowToken,
	focusModes,
	type FlowId,
	type FocusModeId,
	type LayerId
} from '../../data/focus';
import { artStufe, type Modell, type Teil } from './quartier';
import type { Richtung } from './pakete';

/** A game mode or a custom choice of flows. */
export type Modus = FocusModeId | 'eigen';
export type StufeWahl = 'bedeutung' | 1 | 2 | 3 | 4 | 5;
export type Oberflaeche = 'matt' | 'milchig' | 'glas';
export type Ansicht = {
	modus: Modus;
	/** Flows in focus, at most three (MAX_FOKUS_STROEME). */
	stroeme: FlowId[];
	stufe: StufeWahl;
	oberflaeche: Oberflaeche;
};

const modusStroeme = (id: FocusModeId): FlowId[] => [
	...(focusModes.find((m) => m.id === id)?.flows ?? [])
];

/** View of a mode: flows come from the mode, step and surface stay. */
export const mitModus = (a: Ansicht, id: FocusModeId): Ansicht => ({
	...a,
	modus: id,
	stroeme: modusStroeme(id)
});

/**
 * Selects or deselects a flow. At most three stay in focus: a fourth displaces the oldest.
 * The choice is then "eigen" (custom), not a game mode.
 */
export function waehleStrom(stroeme: FlowId[], strom: FlowId): FlowId[] {
	if (stroeme.includes(strom)) return stroeme.filter((s) => s !== strom);
	return [...stroeme, strom].slice(-MAX_FOKUS_STROEME);
}

export const startAnsicht: Ansicht = {
	modus: 'rueckbau',
	stroeme: modusStroeme('rueckbau'),
	stufe: 'bedeutung',
	oberflaeche: 'matt'
};

/** Opacity per surface as a token (app.css). Matte is solid, milky is glass, glass is hull. */
export const oberflaecheAlpha: Record<Oberflaeche, string> = {
	matt: '--alpha-solid',
	milchig: '--alpha-glass',
	glas: '--alpha-hull'
};

export type Klasse = 'ruhig' | 'funktion' | 'signal';
export type Ebene = LayerId;

export type Faerbung = {
	id: string;
	fill: string;
	kante: string;
	alpha: string;
	oberflaeche: Oberflaeche;
	klasse: Klasse;
	ebene: Ebene;
};

const stufeToken = (strom: FlowId, stufe: number) =>
	stufe === 4 ? flowToken[strom] : `${flowToken[strom]}-${stufe}`;

const neutral = (id: string, ebene: Ebene, fill = '--paper'): Faerbung => ({
	id,
	fill,
	kante: ebene === 'focus' ? '--ink' : ebene === 'context' ? '--ink-3' : '--line',
	alpha: ebene === 'background' ? '--alpha-hull' : '--alpha-solid',
	oberflaeche: 'matt',
	klasse: 'ruhig',
	ebene
});

/** Flow mode: at least one flow in focus (a custom choice too). */
const stromModus = (a: Ansicht) => a.modus !== 'bauen' && a.modus !== 'bestand';

/**
 * Focus layer of a part in the mode. Ground is always context. Flow modes: selected flows in
 * focus, existing stock, core and structural frame as context, other new builds as hull. Build:
 * structural frame and core in focus, volumes as block, flat parts as hull. Existing Stock: old
 * buildings in focus, core as context, new additions as hull.
 */
export function ebene(t: Teil, a: Ansicht): Ebene {
	if (t.rolle === 'boden') return 'context';
	if (a.modus === 'bestand') {
		if (t.rolle === 'bestand') return 'focus';
		return t.id === 'kern' ? 'context' : 'background';
	}
	if (a.modus === 'bauen') {
		if (t.rolle === 'geruest' || t.id === 'kern') return 'focus';
		if (t.rolle === 'bestand') return 'context';
		return t.art === 'volumen' || t.art === 'kern' ? 'context' : 'background';
	}
	if (t.strom && t.rolle === 'neu' && a.stroeme.includes(t.strom)) return 'focus';
	return t.rolle === 'neu' && t.strom ? 'background' : 'context';
}

/** Colors a part by its focus layer. Only what is in focus and serves a flow carries color. */
export function faerbe(t: Teil, a: Ansicht): Faerbung {
	const e = ebene(t, a);
	// The structural frame stays signal as long as it is not hull: signal marks the frame in every mode.
	if (t.rolle === 'geruest' && e !== 'background')
		return { ...neutral(t.id, e, '--signal'), kante: '--signal', klasse: 'signal' };
	if (e !== 'focus' || !t.strom || !t.art || !stromModus(a)) return neutral(t.id, e);
	const stufe = a.stufe === 'bedeutung' ? artStufe[t.art] : a.stufe;
	const oberflaeche = t.art === 'volumen' || t.art === 'kern' ? a.oberflaeche : 'matt';
	return {
		id: t.id,
		fill: stufeToken(t.strom, stufe),
		kante: oberflaeche === 'matt' ? '--ink' : stufeToken(t.strom, 5),
		alpha: oberflaecheAlpha[oberflaeche],
		oberflaeche,
		klasse: 'funktion',
		ebene: e
	};
}

/** Paths whose packets glow: only the flows in focus. */
export const aktiveWege = (m: Modell, a: Ansicht) =>
	stromModus(a) ? m.wege.filter((w) => a.stroeme.includes(w.strom)) : [];

/**
 * Color of a packet: outbound in the base tone (step 4), returning in the core (step 5).
 * Both steps stand out from the background in light and dark; the return flow stays the same flow.
 */
export const paketToken = (strom: FlowId, richtung: Richtung) =>
	stufeToken(strom, richtung === 1 ? 4 : 5);

/** All tokens the scene may need per view (for resolution in the browser). */
export function laborTokens(): string[] {
	const stroeme = Object.keys(flowToken) as FlowId[];
	return [
		'--paper',
		'--paper-2',
		'--line',
		'--ink',
		'--ink-2',
		'--ink-3',
		'--signal',
		...stroeme.flatMap((s) => [1, 2, 3, 4, 5].map((n) => stufeToken(s, n)))
	];
}

/**
 * Visible area share per class in the iso view (azimuth 45°, elevation in radians),
 * without occlusion, weighted by opacity. Roughly checks the 75/20/5 quantity rule.
 */
export function anteile(
	m: Modell,
	a: Ansicht,
	alpha: Record<string, number>,
	elevation = Math.PI / 6
): Record<Klasse, number> {
	const sum: Record<Klasse, number> = { ruhig: 0, funktion: 0, signal: 0 };
	const oben = Math.sin(elevation),
		seite = Math.cos(elevation) * Math.SQRT1_2;
	for (const t of m.teile) {
		const f = faerbe(t, a);
		const [x, y, z] = t.size;
		const flaeche = x * y * oben + (x + y) * z * seite;
		const w = alpha[f.alpha] ?? 1;
		sum[f.klasse] += flaeche * w;
		// Whatever shows through counts as paper.
		sum.ruhig += flaeche * (1 - w);
	}
	const total = sum.ruhig + sum.funktion + sum.signal;
	return {
		ruhig: sum.ruhig / total,
		funktion: sum.funktion / total,
		signal: sum.signal / total
	};
}
