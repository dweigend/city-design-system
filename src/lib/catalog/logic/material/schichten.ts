/**
 * Scenes for the focused layer demos below the picker, in meters (x right, y depth, z up).
 * Pure and deterministic: geometry comes from the seeded house generator or fixed specimen
 * blocks; only skins follow the inputs.
 */
import { form, type Stueck, type Teil } from './formen';
import type { FormId } from '../../data/materialSeite';
import { blockEntwurf, hausRezept, type HausTeil } from './hausBausteine';
import { pickerHaut, pickerZonen, type PickerZustand } from './picker';
import { bekleide, siedlungEntwurf } from './siedlung';
import { rezept, voreinstellung, type Rezept } from './rezept';

/** House seed shared by the color-target cases, so only the skin differs between them. */
const FARBZIEL_SAAT = 4;
/** Center spacing of demo pieces along x in meters; wider than the largest house footprint. */
const ABSTAND_M = 6.6;

/** One flow color on three textures: one that takes pigment, glass, and a self-colored finish. */
export const farbZielFaelle: readonly PickerZustand[] = [
	{ material: 'keramik', textur: 'keramik-glasiert', farbe: 'people', saat: FARBZIEL_SAAT },
	{ material: 'glas', textur: 'glas-klar', farbe: 'people', saat: FARBZIEL_SAAT },
	{ material: 'metall', textur: 'metall-messing', farbe: 'people', saat: FARBZIEL_SAAT }
];

/** Moves a draft along x and prefixes its ids; fixed per-part skins stay with their parts. */
function versetzt(entwurf: readonly HausTeil[], dx: number, praefix: string): HausTeil[] {
	return entwurf.map(({ id, teil, ...part }) => {
		const lage: Teil['lage'] = [teil.lage[0] + dx, teil.lage[1], teil.lage[2]];
		return { ...part, id: `${praefix}${id}`, teil: { ...teil, lage } };
	});
}

/** Wall corner for the close-up loupe: two walls, a punched window with dark core, cornice and plinth. */
const LUPE_ENTWURF: readonly HausTeil[] = [
	blockEntwurf('plinth', [2.3, 1.9, 0.24], [0, 0, 0], 'sockel'),
	blockEntwurf('core', [1.5, 1.2, 1.9], [-0.1, 0.2, 0.24], 'kern'),
	blockEntwurf('front', [2.1, 0.24, 1.9], [0, -0.73, 0.24], 'huelle', {
		art: 'fassade',
		fenster: [[0.3, 0.32, 0.36, 0.42]]
	}),
	blockEntwurf('side', [0.24, 1.46, 1.9], [0.93, 0.12, 0.24], 'huelle', {
		art: 'fassade',
		quer: true,
		fenster: []
	}),
	blockEntwurf('cornice', [2.2, 1.8, 0.1], [0, 0, 2.14], 'akzent')
];

/** Close-up of the picked skin on a wall corner, about 2 m wide, so grain and gloss read. */
export function lupenSzene(z: PickerZustand): Stueck[] {
	return bekleide(LUPE_ENTWURF, pickerZonen(z));
}

/**
 * Repeats the picker's first settlement house (same seed, same topology) once per case in a row,
 * dressed with that case's color-target rule. Fixed finishes of the house keep their own skin.
 */
export function farbZielSzene(faelle: readonly PickerZustand[] = farbZielFaelle): Stueck[] {
	return faelle.flatMap((fall, i) => {
		const dx = (i - (faelle.length - 1) / 2) * ABSTAND_M;
		const entwurf = versetzt(siedlungEntwurf(fall.saat, 1), dx, `c${i}-`);
		return bekleide(entwurf, pickerZonen(fall));
	});
}

/** Center spacing of the form studies along x in meters. */
const FORM_ABSTAND_M = 7.4;
const FORMEN: readonly FormId[] = ['box', 'kuppel', 'turm', 'bestand'];
const bestandRezept = () => rezept('bestand', voreinstellung('bestand', 'neutral'));

/**
 * The picked skin on the four study forms in a row: flat, curved and stacked new parts, then new
 * construction on white existing stock. Pattern runs in world meters across every form; stock
 * keeps its neutral recipe and hidden cores stay out. `nur` keeps one form alone at the center,
 * so the stage frames it close and its grain, joints and gloss read; ids stay the same.
 */
export function formenSzene(z: PickerZustand, nur?: FormId): Stueck[] {
	const { huelle } = pickerZonen(z);
	const neu = hausRezept(huelle);
	const formen = nur ? [nur] : FORMEN;
	return formen.flatMap((id, i) =>
		form(id)
			.filter((teil) => teil.rolle !== 'kern')
			.map((teil, j) => {
				const dx = (i - (formen.length - 1) / 2) * FORM_ABSTAND_M;
				const lage: Teil['lage'] = [teil.lage[0] + dx, teil.lage[1], teil.lage[2]];
				const bestand = teil.rolle === 'bestand';
				return {
					id: `${id}-${j}`,
					teil: { ...teil, lage },
					rezept: bestand ? bestandRezept() : structuredClone(neu),
					ausfuehrung: bestand ? undefined : huelle.finish
				};
			})
	);
}

/**
 * Diagram recipe of the picked skin for the node-chain demo: the family preset with the flow the
 * skin actually carries (neutral when the color moved to the frames).
 */
export function pickerDiagrammRezept(z: PickerZustand): Rezept {
	const strom = pickerHaut(z).huelle.strom ?? 'neutral';
	return rezept(z.material, voreinstellung(z.material, strom));
}
