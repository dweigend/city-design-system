import { flows } from '../../data/focus';
import type { Ausfuehrung } from '../../data/materialAusfuehrung';
import {
	achsenWahl,
	familien,
	formWahl,
	rezeptFamilien,
	type FamilieId,
	type FormId
} from '../../data/materialSeite';
import { ausfuehrungenVon } from './ausfuehrung';
import { formSzene, type Stueck } from './formen';
import { rezept, voreinstellung, type Rezept, type Strom, type Wahl } from './rezept';
import { mischSzene, probeMitRezept } from './studien';
import {
	materialVariation,
	musterVersatzM,
	rauschStaerke,
	variationFaehig,
	variationVorgabe,
	type MaterialVariation
} from './variation';

type MaterialAuswahl = {
	finish: Ausfuehrung;
	form: 'probe' | 'montage' | FormId;
	wahl: Wahl;
	variation: MaterialVariation;
};
type Feld = keyof Wahl | 'familie' | 'beispiel' | 'finish' | 'form' | 'noise' | 'seed';
export type MaterialWahl = (feld: Feld, wert: string | number) => void;

function familienStart(id: FamilieId, strom: Strom) {
	return {
		finish: ausfuehrungenVon(id)[0],
		wahl: voreinstellung(id, strom),
		variation: materialVariation()
	};
}

/** New independent workbench, initially the neutral concrete specimen with native finish and grain. */
export function materialStart(): MaterialAuswahl {
	return { ...familienStart('beton', 'neutral'), form: 'probe' };
}

function wechsleFamilie(z: MaterialAuswahl, wert: string, mitBeispiel: boolean) {
	const f = familien.find((f) => f.id === wert);
	if (!f) return z;
	const beispiel = mitBeispiel && rezeptFamilien.find((x) => x.id === f.id);
	const strom = beispiel ? beispiel.strom : z.wahl.strom;
	return { ...z, ...familienStart(f.id, strom) };
}

function wechsleForm(z: MaterialAuswahl, wert: string): MaterialAuswahl {
	const form =
		wert === 'probe' || wert === 'montage' ? wert : formWahl.find((x) => x.value === wert)?.value;
	return form ? { ...z, form } : z;
}

function wechsleStrom(z: MaterialAuswahl, wert: string): MaterialAuswahl {
	const strom = wert === 'neutral' ? wert : flows.find((f) => f.id === wert)?.id;
	return strom ? { ...z, wahl: { ...z.wahl, strom } } : z;
}

/**
 * Applies one control action without mutating its input. A family switch resets its finish, steps and
 * variation and keeps the chosen form and flow. A diagram example also loads its authored flow.
 * Unknown choices retain the selection. Noise and seed use the deterministic variation bounds.
 */
export function waehleMaterial(
	z: MaterialAuswahl,
	feld: Feld,
	wert: string | number
): MaterialAuswahl {
	if (feld === 'seed')
		return { ...z, variation: materialVariation(z.variation.noise, Number(wert)) };
	if (typeof wert !== 'string') return z;
	switch (feld) {
		case 'familie':
		case 'beispiel':
			return wechsleFamilie(z, wert, feld === 'beispiel');
		case 'finish': {
			const finish = ausfuehrungenVon(z.finish.familie).find((a) => a.id === wert);
			return finish ? { ...z, finish } : z;
		}
		case 'form':
			return wechsleForm(z, wert);
		case 'noise':
			return { ...z, variation: materialVariation(wert, z.variation.seed) };
		case 'strom':
			return wechsleStrom(z, wert);
		default:
			return achsenWahl[feld].some((x) => x.value === wert)
				? { ...z, wahl: { ...z.wahl, [feld]: wert } }
				: z;
	}
}

function werkstattRezept(z: MaterialAuswahl, variation: MaterialVariation, strom: Strom): Rezept {
	const r = rezept(z.finish.familie, { ...z.wahl, strom });
	if (!r.rauschen) return r;
	r.rauschen.staerke *= rauschStaerke[variation.noise];
	if (variation.seed !== 0) r.rauschen.versatzM = musterVersatzM(variation.seed);
	return r;
}

function werkstattTeile(z: MaterialAuswahl, r: Rezept) {
	if (z.form === 'montage') return mischSzene();
	if (z.form === 'probe') return probeMitRezept(r, z.finish.id);
	return formSzene(z.form, r);
}

/**
 * Resolves the current recipe and studio pieces in meters, plus the controls that can affect them.
 * All featured specimen/form parts share that recipe. The assembly changes only matching new
 * pieces' finish and keeps its authored flows and steps. Supports always retain their own surface.
 */
export function materialWerkstatt(z: MaterialAuswahl) {
	const variabel = variationFaehig(z.finish.id);
	const variation = variabel ? z.variation : variationVorgabe;
	const pigmentierbar = z.finish.pigment > 0;
	const r = werkstattRezept(z, variation, pigmentierbar ? z.wahl.strom : 'neutral');
	const teile = werkstattTeile(z, r);
	let fokus: Stueck | undefined;
	const fein = z.form !== 'montage';
	const stuecke = teile.map((s) => {
		if (s.teil.rolle !== 'neu' || s.rezept.familie !== r.familie) return s;
		const neu =
			fein && variabel
				? { ...s, ausfuehrung: z.finish.id, variation }
				: { ...s, ausfuehrung: z.finish.id };
		fokus ??= neu;
		return neu;
	});
	return {
		auswahl: z,
		rezept: r,
		stuecke,
		fokus,
		stromAktiv: fein && pigmentierbar,
		deckkraftAktiv: fein && z.finish.deckkraft === undefined && z.finish.transmission === 0,
		kanteAktiv: fein && !(z.form === 'probe' && r.familie === 'wasser'),
		variationAktiv: fein && variabel
	};
}

export type MaterialWerkstatt = ReturnType<typeof materialWerkstatt>;
