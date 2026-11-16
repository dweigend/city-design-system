import type { FlowId } from './focus';
export const ZOOM = ['stadt', 'quartier', 'haus', 'nah'] as const;
export const MODI = [
	'ansehen',
	'auswaehlen',
	'bauen',
	'wege',
	'versorgung',
	'ernte',
	'rueckbau',
	'bestand',
	'analysieren',
	'erklaeren'
] as const;
export const SITUATIONEN = ['normal', 'rechnen', 'stoerung'] as const;
export type Zoom = (typeof ZOOM)[number];
export type Modus = (typeof MODI)[number];
export type Situation = (typeof SITUATIONEN)[number];
export type Kontext = { zoom: Zoom; modus: Modus; situation: Situation; thema?: 'hell' | 'dunkel' };
export const ROLLEN = [
	'bestand',
	'traeger',
	'huelle',
	'raum',
	'weg',
	'gruen',
	'figur',
	'auswahl',
	'geplant',
	'kontext',
	'analyse',
	'gefahr'
] as const;
export type Rolle = (typeof ROLLEN)[number];
/** Single owner of the path mapping; contract from focus.ts. */
export const WEG_STROM: FlowId = 'people';
export const BLICK = { azimutRad: (32 * Math.PI) / 180, hoeheRad: (26 * Math.PI) / 180 };
export const LICHT = [-0.62, 0.28, -1] as const;
export const MASSSTAB = { stadt: 2.5, quartier: 9.2, haus: 21, nah: 60 };
export const STRICHE = { bestand: 0.75, detail: 0.6, kontur: 1.2, minimumTraeger: 1.5 };
export const TOENE = {
	modellweiss: 0.975,
	oben: 0,
	vorn: -0.032,
	rechts: -0.075,
	unten: -0.11,
	schatten: 0.935,
	bleistift: 0.73,
	bestandFokus: 0.55
};
export const ZOOM_BASIS = {
	stadt: { raum: 2, weg: 4, level: 'block', innen: false },
	quartier: { raum: 2, weg: 4, level: 'mid', innen: true },
	haus: { raum: 3, weg: 4, level: 'detail', innen: true },
	nah: { raum: 2, weg: 3, level: 'detail', innen: true }
} as const;
export const MODUS_VERSCHIEBUNG = {
	ansehen: { signal: null },
	auswaehlen: { signal: 'auswahl' },
	bauen: { signal: 'baustelle', raum: 1, weg: 2 },
	wege: { signal: 'auswahl' },
	versorgung: { signal: 'auswahl' },
	ernte: { signal: 'auswahl' },
	rueckbau: { signal: 'auswahl' },
	bestand: { signal: 'auswahl' },
	analysieren: { signal: 'auswahl' },
	erklaeren: { signal: null }
} as const;
export const SITUATION_VERSCHIEBUNG = {
	normal: { raumDelta: 0 },
	rechnen: { raumDelta: 0 },
	stoerung: { raumDelta: -1 }
};
export const DICHTE = {
	stadt: { neutralMin: 0.85, kraeftigMax: 0.03, figurenMax: 0, labelsMax: 3 },
	quartier: { neutralMin: 0.75, kraeftigMax: 0.06, figurenMax: 30, labelsMax: 5 },
	haus: { neutralMin: 0.7, kraeftigMax: 0.08, figurenMax: 8, labelsMax: 5 },
	nah: { neutralMin: 0.65, kraeftigMax: 0.08, figurenMax: 3, labelsMax: 5 }
};

/** Projection tones; flow colors stay entirely in focus.ts / CSS. */
export const PROJEKTION_TOENE = {
	dunkel: { modellweiss: 0.8, tusche: 1, kontur: 0.85, bleistift: 0.43, schatten: 0.27 },
	hell: { kontur: 0.36 }
};
