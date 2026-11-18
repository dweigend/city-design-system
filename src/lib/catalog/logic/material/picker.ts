import { flowToken, type FlowId } from '../../data/focus';
import { materialSpec } from '../../data/material';
import type { AusfuehrungId } from '../../data/materialAusfuehrung';
import {
	AKZENT_ANTEIL,
	ausgeschlosseneTexturen,
	farbAnteilVon,
	MIN_FARBANTEIL,
	texturFolge,
	pickerFarben,
	pickerFarbNamen,
	pickerMaterialien
} from '../../data/materialPicker';
import { familie, type FamilieId } from '../../data/materialSeite';
import { ausfuehrungenVon } from './ausfuehrung';
import { beton, graphit, type HausZone, type Haut } from './hausBausteine';
import { bekleide, siedlungEntwurf } from './siedlung';
import { maximaleMusterSaat } from './variation';

export type PickerFarbe = 'natur' | FlowId;
export type PickerZustand = Readonly<{
	material: FamilieId;
	textur: AusfuehrungId;
	farbe: PickerFarbe;
	saat: number;
}>;
export type PickerFeld = keyof PickerZustand;
export type RadOption = Readonly<{ value: string; label: string; muster?: string }>;
export type FarbZiel = 'huelle' | 'akzent';

function texturen(material: FamilieId) {
	const liste = ausfuehrungenVon(material).filter((f) => !ausgeschlosseneTexturen.has(f.id));
	const folge = texturFolge[material];
	if (!folge) return liste;
	const rang = (id: AusfuehrungId) => (folge.includes(id) ? folge.indexOf(id) : folge.length);
	return liste.sort((a, b) => rang(a.id) - rang(b.id));
}

/** Opens a new picker with glazed clay, the water flow and seed 1. */
export function pickerStart(): PickerZustand {
	return { material: 'keramik', textur: 'keramik-glasiert', farbe: 'water', saat: 1 };
}

function waehleSaat(z: PickerZustand, wert: unknown): PickerZustand {
	if (typeof wert !== 'number' || !Number.isFinite(wert)) return z;
	const saat = Math.max(0, Math.min(maximaleMusterSaat, Math.round(wert)));
	return saat === z.saat ? z : { ...z, saat };
}

/** Applies one wheel action without mutation. Invalid or unchanged values retain identity.
 * Finite numeric seeds round to the nearest integer and clamp to the supported seed range. */
export function waehlePicker(z: PickerZustand, feld: PickerFeld, wert: unknown): PickerZustand {
	if (z[feld] === wert) return z;
	switch (feld) {
		case 'material': {
			const material = pickerMaterialien.find((id) => id === wert);
			return material ? { ...z, material, textur: texturen(material)[0].id } : z;
		}
		case 'textur': {
			const finish = texturen(z.material).find((f) => f.id === wert);
			return finish ? { ...z, textur: finish.id } : z;
		}
		case 'farbe': {
			const farbe = pickerFarben.find((id) => id === wert);
			return farbe ? { ...z, farbe } : z;
		}
		case 'saat':
			return waehleSaat(z, wert);
		default:
			return z;
	}
}

/** Lists detached options in picker order, with native and selected-family finish swatches in hex. */
export function pickerRaeder(
	z: PickerZustand
): Record<'material' | 'textur' | 'farbe', RadOption[]> {
	const natur = gewaehlteTextur(z).grundton;
	return {
		material: pickerMaterialien.map((value) => ({
			value,
			label: familie(value).name,
			muster: texturen(value)[0].grundton
		})),
		textur: texturen(z.material).map((f) => ({ value: f.id, label: f.name, muster: f.grundton })),
		farbe: pickerFarben.map((value) => ({
			value,
			label: pickerFarbNamen.get(value) ?? value,
			muster: value === 'natur' ? natur : flowToken[value]
		}))
	};
}

type PickerHaut = Readonly<{
	huelle: Haut;
	akzent: Haut;
	farbZiel: FarbZiel;
	/** One always-filled status line: texture, and where the color goes. */
	status: string;
}>;

function gewaehlteTextur(z: PickerZustand) {
	const finish = texturen(z.material).find((a) => a.id === z.textur);
	if (!finish) throw new RangeError('Texture must belong to the selected material.');
	return finish;
}

/** True when the skin keeps its own color: neutral family rule (glass) or a finish without pigment. */
function eigenfarbig(z: PickerZustand): boolean {
	const f = familie(z.material);
	return (
		(f.farbe ?? materialSpec(f.material).color) === 'neutral' || gewaehlteTextur(z).pigment === 0
	);
}

/** Skin that takes the flow color, with a pigment share high enough to read at house scale. */
function gefaerbteHuelle(z: PickerZustand, strom: FlowId): Haut {
	const finish = gewaehlteTextur(z);
	const huelle: Haut = { familie: z.material, finish: finish.id };
	const anteil = farbAnteilVon[finish.id] ?? Math.max(finish.pigment, MIN_FARBANTEIL);
	return { ...huelle, strom, anteil };
}

/**
 * Resolves detached skin and accent. A finish that takes pigment carries the flow color itself;
 * glass and pigment-free finishes keep their own color and the accent zone (door, cornice,
 * plinth) carries it instead. `status` names the texture and the color's target in one line.
 */
export function pickerHaut(z: PickerZustand): PickerHaut {
	const name = gewaehlteTextur(z).name;
	const farbe = pickerFarbNamen.get(z.farbe) ?? z.farbe;
	if (z.farbe === 'natur') {
		const huelle = { familie: z.material, finish: z.textur };
		const farbZiel = eigenfarbig(z) ? 'akzent' : 'huelle';
		return { huelle, akzent: { ...graphit }, farbZiel, status: `${name} · own color` };
	}
	if (!eigenfarbig(z)) {
		const status = `${name} · ${farbe} on the skin`;
		return {
			huelle: gefaerbteHuelle(z, z.farbe),
			akzent: { ...graphit },
			farbZiel: 'huelle',
			status
		};
	}
	const akzent: Haut = {
		familie: 'metall',
		finish: 'metall-lackiert',
		strom: z.farbe,
		anteil: AKZENT_ANTEIL
	};
	const status = `${name} keeps its color · ${farbe} on door, cornice and plinth`;
	return { huelle: { familie: z.material, finish: z.textur }, akzent, farbZiel: 'akzent', status };
}

/** Zone skins for dressing: skin and accent from `pickerHaut`; the plinth joins the accent while
 * it carries a flow color, else stays cast concrete; cores stay graphite. */
export function pickerZonen(z: PickerZustand): Record<HausZone, Haut> {
	const haut = pickerHaut(z);
	const sockel = haut.akzent.strom ? haut.akzent : beton;
	return { huelle: haut.huelle, akzent: haut.akzent, sockel, kern: graphit };
}

/** Dresses three seeded houses in stable part order, returning owned geometry and effective skins. */
export function pickerSzene(z: PickerZustand) {
	return { stuecke: bekleide(siedlungEntwurf(z.saat), pickerZonen(z)), haut: pickerHaut(z) };
}
