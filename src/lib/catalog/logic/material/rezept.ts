/**
 * Material recipe: family × flow color × axes → the values of the six nodes
 * (tone, color, noise, joints, edge, skin). Pure, without three.js. The stage
 * (scene/materialRezept.ts) translates a recipe one to one into TSL; `tslQuelle` writes
 * the same values as readable TSL code (logic/material/tslQuelle.ts). Units: meters, shares 0–1.
 */
import {
	alphaSteps,
	diffusionSteps,
	edgeSteps,
	finishSteps,
	materialSpec,
	milkSteps,
	type AlphaStep,
	type EdgeStep,
	type FinishStep,
	type Tint
} from '../../data/material';
import {
	familie,
	rauheitSteps,
	type FamilieId,
	type FugenArt,
	type KnotenId,
	type RauheitStep,
	type RauschArt,
	type StufePhaseId
} from '../../data/materialSeite';
import { flowToken, type FlowId } from '../../data/focus';
import type { ColorToken } from '../parametrik/types';

export type Strom = FlowId | 'neutral';

/** What the reader chooses in the lab. */
export type Wahl = {
	strom: Strom;
	rauheit: RauheitStep;
	glanz: FinishStep;
	deckkraft: AlphaStep;
	kante: EdgeStep;
};

export type Rezept = {
	familie: FamilieId;
	farbe: { token: ColorToken; papier: number; tint: Tint };
	ton: { kontrast: number };
	rauschen: { art: RauschArt; massstab: number; staerke: number } | null;
	fugen: { art: FugenArt; abstand: number; staerke: number } | null;
	/** Edge line: share of paper in the ink, relative width; null = no edge, no outline. */
	kante: { papier: number; breite: number } | null;
	haut: {
		/** Soft sheen on grazing surfaces. */
		sheen: number;
		/** Hard highlight and gloss edge. */
		glanz: number;
		/** Half width of the highlight (1 − cos angle). */
		glanzbreite: number;
		/** Turbidity toward paper. */
		truebung: number;
		/** Opacity of the surface (alpha step). */
		deckkraft: number;
		/** Share of what shows through that arrives blurred, and the blur (mip level). */
		diffusion: number;
		unschaerfe: number;
		/** The material moves over time (water). */
		bewegt: boolean;
	};
};

/** Preset of a family: the steps of its game material. */
export function voreinstellung(id: FamilieId, strom: Strom = 'water'): Wahl {
	const f = familie(id),
		spec = materialSpec(f.material);
	return {
		strom,
		rauheit: f.rauheit,
		glanz: spec.finish,
		deckkraft: spec.alpha,
		kante: spec.edge
	};
}

/** Color rule: existing stock and glass stay neutral, water always carries the water flow. */
function farbeVon(id: FamilieId, strom: Strom): Rezept['farbe'] {
	const f = familie(id),
		spec = materialSpec(f.material),
		regel = f.farbe ?? spec.color;
	if (regel === 'eigen')
		return { token: spec.tint.toward ?? '--cat-health', papier: spec.pigment, tint: {} };
	if (regel === 'neutral' || strom === 'neutral')
		return { token: '--paper', papier: 0, tint: { ...spec.tint } };
	return {
		token: flowToken[strom],
		papier: spec.pigment,
		tint: spec.tint.ink ? { ink: round(spec.tint.ink * 0.3) } : {}
	};
}

const round = (v: number) => Math.round(v * 1000) / 1000;

export function rezept(id: FamilieId, wahl: Wahl = voreinstellung(id)): Rezept {
	const f = familie(id),
		spec = materialSpec(f.material);
	const rau = rauheitSteps[wahl.rauheit],
		fin = finishSteps[wahl.glanz],
		edge = edgeSteps[wahl.kante],
		alpha = alphaSteps[wahl.deckkraft];
	const diff = alpha < 1 ? diffusionSteps[spec.diffusion] : diffusionSteps.keine;
	return {
		familie: id,
		farbe: farbeVon(id, wahl.strom),
		ton: { kontrast: fin.contrast },
		rauschen: f.rauschen
			? { ...f.rauschen, staerke: round(f.rauschen.staerke * rau.rauschen) }
			: null,
		fugen: f.fugen ? { ...f.fugen } : null,
		kante: edge ? { papier: edge.paper, breite: edge.width } : null,
		haut: {
			sheen: fin.sheen,
			glanz: fin.gloss,
			glanzbreite: rau.glanzbreite,
			truebung: milkSteps[spec.milk],
			deckkraft: alpha,
			diffusion: diff.share,
			unschaerfe: diff.blur,
			bewegt: id === 'wasser'
		}
	};
}

/**
 * Coverage of the surface: of the share that shows through (1 − opacity), `diffusion` arrives blurred.
 * The blurred part is mixed into the color (weight `hinten`) and adds to the coverage.
 */
export function deckung(h: Rezept['haut']): { opacity: number; hinten: number } {
	const unscharf = (1 - h.deckkraft) * h.diffusion;
	const opacity = h.deckkraft + unscharf;
	return { opacity: round(opacity), hinten: opacity > 0 ? round(unscharf / opacity) : 0 };
}

/** Neutral skin: opaque, without gloss, without turbidity. */
const ohneHaut = (r: Rezept): Rezept['haut'] => ({
	...r.haut,
	sheen: 0,
	glanz: 0,
	truebung: 0,
	deckkraft: 1,
	diffusion: 0,
	unschaerfe: 0
});

/** Node sequence of the kit. */
export const knotenFolge: KnotenId[] = ['ton', 'farbe', 'rauschen', 'fugen', 'kante', 'haut'];

/** Recipe up to and including node `n` (1 = tone only … 6 = complete). */
export function bisKnoten(r: Rezept, n: number): Rezept {
	const k = Math.max(1, Math.min(6, Math.floor(n)));
	return {
		...r,
		farbe: k >= 2 ? r.farbe : { token: '--paper', papier: 0, tint: { ink: 0.22 } },
		rauschen: k >= 3 ? r.rauschen : null,
		fugen: k >= 4 ? r.fugen : null,
		kante: k >= 5 ? r.kante : null,
		haut: k >= 6 ? r.haut : { ...ohneHaut(r), bewegt: k >= 3 && r.haut.bewegt }
	};
}

/** Existing stock as ghost: milky, semi-transparent, muted edge, without grain. */
export function alsGeist(r: Rezept): Rezept {
	const ghost = materialSpec('ghost'),
		edge = edgeSteps[ghost.edge],
		diff = diffusionSteps[ghost.diffusion];
	return {
		...r,
		rauschen: null,
		fugen: null,
		kante: edge ? { papier: edge.paper, breite: edge.width } : null,
		ton: { kontrast: finishSteps[ghost.finish].contrast },
		haut: {
			...ohneHaut(r),
			truebung: milkSteps[ghost.milk],
			deckkraft: alphaSteps[ghost.alpha],
			diffusion: diff.share,
			unschaerfe: diff.blur
		}
	};
}

/** Detail level: the farther away, the shorter the recipe. */
export function detailstufe(r: Rezept, stufe: StufePhaseId): Rezept {
	switch (stufe) {
		case 'nah':
		case 'geist':
			return r;
		case 'mittel':
			return { ...r, rauschen: null, fugen: null };
		case 'fern':
			return {
				...r,
				rauschen: null,
				fugen: null,
				haut: { ...ohneHaut(r), deckkraft: 1, bewegt: false }
			};
		case 'linie':
			return {
				...r,
				farbe: { token: '--paper', papier: 0, tint: {} },
				ton: { kontrast: 0.25 },
				rauschen: null,
				fugen: null,
				kante: { papier: 0, breite: 1 },
				haut: { ...ohneHaut(r), bewegt: false }
			};
	}
}
